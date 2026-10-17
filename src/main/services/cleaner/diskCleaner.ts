import { readdir, lstat, rm, stat } from 'fs/promises'
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
  return found.sort((a, b) => a.projectPath.localeCompare(b.projectPath))
}

/** Recursive size without following symlinks (pnpm uses many). */
export async function folderSize(path: string): Promise<number> {
  if (!allowed.has(path)) throw new Error('Path not found by the last scan')

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
  sizeCache.set(path, total)
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
