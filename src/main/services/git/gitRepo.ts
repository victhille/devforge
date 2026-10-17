import type { FileChangeStatus, GitActionResult, GitFileChange, GitRepoDetails } from '@shared/types'
import { runFile } from '../../lib/exec'

const SEP = '\u001f' // unit separator, never in commit messages

// Never wait on a terminal prompt nobody can see (credential GUI helpers still work)
const GIT_ENV = { GIT_TERMINAL_PROMPT: '0' }

/** git -C <path> <args…>, without a shell. */
export const git = (path: string, args: string[], timeout = 6000) =>
  runFile('git', ['-C', path, ...args], { timeout, env: GIT_ENV })

/** Everything the dashboard shows for one repository, in 3 parallel git calls. */
export async function getRepoDetails(path: string): Promise<GitRepoDetails> {
  const details: GitRepoDetails = {
    path, isRepo: false, branch: null, changes: 0, ahead: 0, behind: 0,
    hasUpstream: false, remoteUrl: null, lastCommit: null
  }

  const [status, log, remote] = await Promise.all([
    git(path, ['status', '--porcelain=v2', '--branch']),
    git(path, ['log', '-1', `--format=%h${SEP}%s${SEP}%an${SEP}%cI`], 4000),
    git(path, ['remote', 'get-url', 'origin'], 4000)
  ])
  if (!status.ok) return details

  details.isRepo = true
  for (const line of status.stdout.split('\n')) {
    if (line.startsWith('# branch.head ')) {
      const head = line.slice('# branch.head '.length).trim()
      details.branch = head === '(detached)' ? 'HEAD' : head
    } else if (line.startsWith('# branch.upstream ')) {
      details.hasUpstream = true
    } else if (line.startsWith('# branch.ab ')) {
      const m = line.match(/\+(\d+) -(\d+)/)
      if (m) { details.ahead = parseInt(m[1]); details.behind = parseInt(m[2]) }
    } else if (line.trim() && !line.startsWith('#')) {
      details.changes++
    }
  }

  if (log.ok) {
    const [hash, message, author, date] = log.stdout.trim().split(SEP)
    if (hash) details.lastCommit = { hash, message, author, date }
  }
  if (remote.ok) details.remoteUrl = remote.stdout.trim() || null

  return details
}

async function action(path: string, args: string[]): Promise<GitActionResult> {
  const r = await git(path, args, 120_000)
  return { ok: r.ok, output: (r.stdout + r.stderr).trim() }
}

export const gitFetch = (path: string) => action(path, ['fetch', '--prune'])
export const gitPull  = (path: string) => action(path, ['pull', '--ff-only'])
export const gitPush  = (path: string) => action(path, ['push'])

const STATUS: Record<string, FileChangeStatus> = { A: 'added', M: 'modified', D: 'deleted', R: 'renamed', C: 'added', T: 'modified', U: 'modified' }

/** numstat output → path → [insertions, deletions] ("-" for binary) */
function parseNumstat(out: string): Map<string, [number | null, number | null]> {
  const map = new Map<string, [number | null, number | null]>()
  for (const line of out.split('\n')) {
    const [a, d, ...rest] = line.split('\t')
    if (!rest.length) continue
    // Renames look like "old => new" or "dir/{old => new}"
    const file = rest.join('\t').replace(/\{[^}]* => ([^}]*)\}/, '$1').replace(/^.* => /, '')
    map.set(file, [a === '-' ? null : Number(a), d === '-' ? null : Number(d)])
  }
  return map
}

export async function getChanges(path: string): Promise<GitFileChange[]> {
  const [status, unstaged, staged] = await Promise.all([
    git(path, ['status', '--porcelain=v1', '-uall', '-z']),
    git(path, ['diff', '--numstat']),
    git(path, ['diff', '--cached', '--numstat'])
  ])
  if (!status.ok) return []
  const counts = parseNumstat(unstaged.stdout)
  for (const [f, [a, d]] of parseNumstat(staged.stdout)) {
    const prev = counts.get(f)
    counts.set(f, prev ? [(prev[0] ?? 0) + (a ?? 0), (prev[1] ?? 0) + (d ?? 0)] : [a, d])
  }

  // -z: entries are NUL-separated; renames are followed by their old path
  const parts = status.stdout.split('\0')
  const changes: GitFileChange[] = []
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    const x = entry[0], y = entry[1], file = entry.slice(3)
    if (x === 'R' || x === 'C') i++ // skip the original path
    const untracked = x === '?'
    const code = untracked ? '?' : x !== ' ' ? x : y
    const [ins, del] = counts.get(file) ?? [null, null]
    changes.push({
      path: file,
      status: untracked ? 'untracked' : STATUS[code] ?? 'modified',
      staged: !untracked && x !== ' ',
      insertions: ins,
      deletions: del
    })
  }
  return changes.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Commit exactly the chosen files with `git commit -- <paths>`: other staged
 * changes stay staged and untouched. Untracked files are added first.
 */
export async function gitCommit(path: string, message: string, files: string[]): Promise<GitActionResult> {
  if (!message.trim()) return { ok: false, output: 'Empty commit message' }
  if (files.length === 0) return { ok: false, output: 'No file selected' }

  const untracked = (await getChanges(path)).filter(c => c.status === 'untracked' && files.includes(c.path)).map(c => c.path)
  if (untracked.length) {
    const add = await git(path, ['add', '--', ...untracked], 30_000)
    if (!add.ok) return { ok: false, output: (add.stdout + add.stderr).trim() }
  }
  return action(path, ['commit', '-m', message, '--', ...files])
}
