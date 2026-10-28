import { existsSync } from 'fs'
import { join } from 'path'
import type { ActivityData, ProjectActivity } from '@shared/types'
import { HEAD_REF_FORMAT, parseGitLog, parseHeadRef, WEEKS } from '@shared/lib/activity'
import { runFile } from '../../lib/exec'
import { loadProjects } from '../projects/projectStorage'
import { git } from './gitRepo'

/**
 * v3.8 lot 3: the commits of every saved project over the last weeks, read
 * from Git on this PC (no online service), a few projects at a time, kept a
 * few minutes. Two git calls per repository, none that scans the files.
 */

const TTL = 3 * 60_000
const PARALLEL = 8
let cache: ActivityData | null = null

async function one(p: { id: string; name: string; path: string }): Promise<ProjectActivity> {
  const base: ProjectActivity = { id: p.id, name: p.name, path: p.path, commits: [], lastCommitAt: null, branch: null, ahead: 0, behind: 0 }
  // A repository's root only: a group's projects share its repository, the group stands for them
  if (!existsSync(join(p.path, '.git'))) return base
  const [log, refs] = await Promise.all([
    git(p.path, ['log', `--since=${WEEKS * 7 + 7}.days`, '--no-merges', '--format=%x1e%at%x1f%ae', '--shortstat'], 15_000),
    git(p.path, ['for-each-ref', HEAD_REF_FORMAT, 'refs/heads'])
  ])
  const head = refs.ok ? parseHeadRef(refs.stdout) : null
  let lastCommitAt = head?.lastCommitAt ?? null
  // Detached HEAD: its own last commit
  if (!head) {
    const last = await git(p.path, ['log', '-1', '--format=%at'])
    lastCommitAt = last.ok && /^\d+/.test(last.stdout.trim()) ? Number(last.stdout.trim()) : null
  }
  return {
    ...base,
    commits: log.ok ? parseGitLog(log.stdout) : [],
    lastCommitAt, branch: head?.branch ?? null, ahead: head?.ahead ?? 0, behind: head?.behind ?? 0
  }
}

export async function getActivity(fresh = false): Promise<ActivityData> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache
  const projects = loadProjects()
  const out: ProjectActivity[] = []
  for (let i = 0; i < projects.length; i += PARALLEL) out.push(...await Promise.all(projects.slice(i, i + PARALLEL).map(one)))
  const email = await runFile('git', ['config', '--global', 'user.email'], { timeout: 5000 })
  cache = { me: email.ok ? email.stdout.trim().toLowerCase() || null : null, projects: out, at: Date.now() }
  return cache
}
