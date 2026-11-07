import { readdir, readFile, stat } from 'fs/promises'
import { join, relative, sep } from 'path'
import { looksBinary } from '@shared/lib/filePreview'
import { buildPattern, fileFilter, findInText, MAX_MATCHES, type SearchFile, type SearchOptions, type SearchResult } from '@shared/lib/projectSearch'
import { isInsideProject } from '../../lib/safe'

/**
 * v3.6 lot 5: a text or a regex looked for in every file of a saved project,
 * dependencies, builds, virtual environments and binary files left out.
 * The files are listed first, then read 32 at a time (OneDrive folders are
 * slow one by one). A newer search stops the one running.
 */

const SKIP = new Set([
  'node_modules', 'vendor', 'dist', 'build', 'out', 'coverage', 'target', 'bin', 'obj', 'venv', 'env', '__pycache__', 'var',
  'test-results', 'playwright-report', 'storage', 'tmp', 'temp', 'logs'
])
/** Hidden folders are skipped (.git, .next, .venv, .cache…) but these, which hold the project's own files */
const HIDDEN_KEPT = new Set(['.github', '.vscode', '.devcontainer', '.circleci', '.gitlab', '.husky', '.claude'])
/** Larger files are skipped (logs, dumps, bundles) */
const MAX_FILE = 1024 * 1024
const MAX_FILES = 20_000
const BATCH = 32

let generation = 0

export async function searchProject(root: string, query: string, o: SearchOptions): Promise<SearchResult> {
  const started = Date.now()
  const mine = ++generation
  const stale = () => mine !== generation
  const empty = (error?: string): SearchResult => ({ files: [], total: 0, truncated: false, durationMs: Date.now() - started, ...(error ? { error } : {}) })
  if (typeof root !== 'string' || !isInsideProject(root)) return empty('Not a saved project')
  if (!query) return empty()
  const pattern = buildPattern(query, o)
  if ('error' in pattern) return empty(pattern.error)
  const wanted = fileFilter(o.include ?? '')

  // The files, in a stable order (folders first, then names), sub-folders listed in parallel
  const list = async (dir: string): Promise<string[]> => {
    if (stale()) return []
    let entries
    try { entries = await readdir(dir, { withFileTypes: true }) } catch { return [] }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    const dirs = entries.filter(e => e.isDirectory() && !SKIP.has(e.name) && (!e.name.startsWith('.') || HIDDEN_KEPT.has(e.name)))
    const nested = await Promise.all(dirs.map(e => list(join(dir, e.name))))
    const files = entries.filter(e => e.isFile()).map(e => join(dir, e.name)).filter(f => wanted(relative(root, f).split(sep).join('/')))
    return [...nested.flat(), ...files]
  }
  const paths = (await list(root)).slice(0, MAX_FILES)

  const files: SearchFile[] = []
  let total = 0
  for (let i = 0; i < paths.length && total < MAX_MATCHES && !stale(); i += BATCH) {
    const found = await Promise.all(paths.slice(i, i + BATCH).map(async full => {
      try {
        if ((await stat(full)).size > MAX_FILE) return null
        const bytes = await readFile(full)
        if (looksBinary(bytes)) return null
        const matches = findInText(bytes.toString('utf-8'), pattern, MAX_MATCHES)
        return matches.length ? { path: relative(root, full).split(sep).join('/'), matches } : null
      } catch { return null }
    }))
    // In order, up to the limit
    for (const f of found) {
      if (!f || total >= MAX_MATCHES) continue
      const room = MAX_MATCHES - total
      files.push({ path: f.path, matches: f.matches.slice(0, room) })
      total += Math.min(f.matches.length, room)
    }
  }
  // Stopped by a newer search: its answer no longer matters
  if (stale()) return { ...empty(), error: 'CANCELLED' }
  return { files, total, truncated: total >= MAX_MATCHES, durationMs: Date.now() - started }
}
