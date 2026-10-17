import type { GitActionResult, GitRepoDetails } from '@shared/types'
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
