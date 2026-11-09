import { execFile, type ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { readdir, lstat, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { basename, dirname, join } from 'path'
import type { CleanCandidate, CleanKind, CleanResult } from '@shared/types'

/** Folder name → kind. Only names that are always safe to regenerate. */
const TARGETS: Record<string, CleanKind> = {
  node_modules: 'dependencies',
  vendor:       'dependencies',   // only when composer.json is next to it
  target:       'dependencies',   // only when Cargo.toml is next to it
  '.venv':      'dependencies',
  venv:         'dependencies',
  dist:         'build',
  build:        'build',          // only next to a package.json
  '.next':      'build',
  '.nuxt':      'build',
  '.output':    'build',
  '.svelte-kit':'build',
  '.turbo':     'cache',
  '.parcel-cache': 'cache',
  '.cache':     'cache',
  coverage:     'cache',
  __pycache__:  'cache'
}

/** Some names are only generated output when a given manifest sits next to them. */
const REQUIRES: Record<string, string[]> = {
  vendor: ['composer.json'],
  target: ['Cargo.toml'],
  build:  ['package.json'],
  dist:   ['package.json'],
  venv:   ['requirements.txt', 'pyproject.toml', 'setup.py']
}

const SKIP = new Set(['.git', '.idea', '.vscode', '$RECYCLE.BIN', 'System Volume Information'])
const MAX_DEPTH = 5

/** Paths returned by the last scan: the only ones size/remove accept. */
let allowed = new Set<string>()
/** Sizes computed since the last scan, used to report freed space */
const sizeCache = new Map<string, number>()

export async function scanForCleanable(root: string): Promise<CleanCandidate[]> {
  const found: CleanCandidate[] = []

  async function walk(dir: string, depth: number): Promise<void> {
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return }
    const names = new Set(entries.map(e => e.name))
    const subdirs: string[] = []

    for (const e of entries) {
      if (!e.isDirectory() || SKIP.has(e.name)) continue
      const kind = TARGETS[e.name]
      const required = REQUIRES[e.name]
      if (kind && (!required || required.some(f => names.has(f)))) {
        found.push({
          path: join(dir, e.name),
          name: e.name,
          kind,
          projectName: basename(dir),
          projectPath: dir,
          projectModified: ''
        })
        continue // never look inside a cleanable folder
      }
      if (depth < MAX_DEPTH && !e.name.startsWith('.')) subdirs.push(join(dir, e.name))
    }
    await Promise.all(subdirs.map(d => walk(d, depth + 1)))
  }

  await walk(root, 0)

  // Project folder mtime, to spot old projects
  await Promise.all(found.map(async c => {
    try { c.projectModified = (await stat(c.projectPath)).mtime.toISOString() } catch { /* keep empty */ }
  }))

  allowed = new Set(found.map(c => c.path))
  sizeCache.clear()
  // The last scan's sizes are no longer wanted: their listings stop
  for (const child of listing) child.kill()
  listing.clear()
  return found.sort((a, b) => a.projectPath.localeCompare(b.projectPath))
}

/**
 * The total bytes in robocopy's summary. Its words follow Windows' language
 * (Bytes, Octets…) but not its order: dirs, files, then bytes, each line
 * « label : total copied… » (with /BYTES, plain numbers).
 */
export function robocopyBytes(output: string): number | null {
  const lines = output.split(/\r?\n/).map(l => /^\s*[^\s\d:][^:]*:\s+(\d+)\s+(\d+)/.exec(l)).filter(m => m !== null)
  return lines.length >= 3 ? Number(lines[2]![1]) : null
}

/** robocopy from System32 by its full path: never one dropped in the current folder or earlier in the PATH */
const ROBOCOPY = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'robocopy.exe')
/** Listings at once (the page asks for 16): more would only wait on the disk */
const MAX_LISTINGS = 16
/** The listings running, stopped when a new scan starts */
const listing = new Set<ChildProcess>()
let busy = 0
const waiting: (() => void)[] = []

/** A place among the listings that run at once; given back when done (stopped or not) */
async function slot(): Promise<() => void> {
  while (busy >= MAX_LISTINGS) await new Promise<void>(go => waiting.push(go))
  busy++
  return () => { busy--; waiting.shift()?.() }
}

/** What robocopy said: the bytes, it could not tell (null: the walk takes over), or it ran out of time */
type Listed = number | null | 'timeout'

/**
 * Windows lists a folder with its files' sizes in one native call: robocopy
 * in list mode (/L: nothing copied, the destination never made), links and
 * junctions skipped (/XJ, as the walk below). About 20 times faster than a
 * stat per file on a node_modules.
 */
async function robocopySize(path: string): Promise<Listed> {
  const done = await slot()
  const nowhere = join(tmpdir(), `devforge-size-${randomUUID()}`)
  try {
    return await new Promise<Listed>(resolve => {
      const child = execFile(ROBOCOPY, [path, nowhere, '/L', '/S', '/NJH', '/NFL', '/NDL', '/NC', '/NS', '/NP', '/BYTES', '/XJ', '/R:0', '/W:0', '/MT:4'],
        { windowsHide: true, timeout: 300_000, maxBuffer: 1024 * 1024 },
        (err, stdout) => {
          listing.delete(child)
          // Exit codes 0 to 7 are success (1: « files to copy »); 8 and up, or no code (not found), a failure
          const e = err as { code?: unknown; killed?: boolean } | null
          if (e?.killed) return resolve('timeout')
          if (e && (typeof e.code !== 'number' || e.code >= 8)) return resolve(null)
          resolve(robocopyBytes(stdout))
        })
      listing.add(child)
    })
  } finally { done() }
}

/**
 * Recursive size without following symlinks (pnpm uses many): Windows' own
 * listing, else a walk. A folder too slow for Windows' listing is not walked
 * (twenty times slower still): its size stays unknown.
 */
export async function folderSize(path: string): Promise<number> {
  if (!allowed.has(path)) throw new Error('Path not found by the last scan')
  const listed = process.platform === 'win32' ? await robocopySize(path) : null
  if (listed === 'timeout') throw new Error('Too long to measure')
  const total = listed ?? await walkSize(path)
  sizeCache.set(path, total)
  return total
}

/** A stat per file, many at a time: everywhere, and when Windows' listing fails */
async function walkSize(path: string): Promise<number> {
  let total = 0
  const queue: string[] = [path]
  const CONCURRENCY = 32

  async function worker() {
    for (let dir = queue.pop(); dir !== undefined; dir = queue.pop()) {
      let entries
      try { entries = await readdir(dir, { withFileTypes: true }) } catch { continue }
      const files: string[] = []
      for (const e of entries) {
        const p = join(dir, e.name)
        if (e.isDirectory()) queue.push(p)
        else if (e.isFile()) files.push(p)
      }
      const sizes = await Promise.all(files.map(f => lstat(f).then(s => s.size, () => 0)))
      for (const s of sizes) total += s
    }
  }

  // Workers drain the queue; restart them while new dirs keep appearing
  while (queue.length > 0) {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  }
  return total
}

export async function removeFolders(paths: string[]): Promise<CleanResult> {
  const result: CleanResult = { removed: [], failed: [], freedBytes: 0 }
  for (const path of paths) {
    if (!allowed.has(path) || !TARGETS[basename(path)] || dirname(path) === path) {
      result.failed.push({ path, error: 'Refused: not found by the last scan' })
      continue
    }
    try {
      await rm(path, { recursive: true, force: true, maxRetries: 3 })
      result.removed.push(path)
      result.freedBytes += sizeCache.get(path) ?? 0
      allowed.delete(path)
    } catch (err) {
      result.failed.push({ path, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return result
}
