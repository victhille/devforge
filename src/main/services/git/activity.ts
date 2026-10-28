import type { ActivityData, ProjectActivity } from '@shared/types'
import { parseGitLog, WEEKS } from '@shared/lib/activity'
import { runFile } from '../../lib/exec'
import { loadProjects } from '../projects/projectStorage'
import { getRepoDetails, git } from './gitRepo'

/**
 * v3.8 lot 3: the commits of every saved project over the last weeks, read
 * from Git on this PC (no online service), six projects at a time, kept a
 * few minutes.
 */

const TTL = 3 * 60_000
const PARALLEL = 6
let cache: ActivityData | null = null

async function one(p: { id: string; name: string; path: string; framework: string }): Promise<ProjectActivity> {
  const base: ProjectActivity = { id: p.id, name: p.name, path: p.path, commits: [], lastCommitAt: null, branch: null, ahead: 0, behind: 0 }
  const details = await getRepoDetails(p.path).catch(() => null)
  if (!details?.isRepo) return base
  const [log, last] = await Promise.all([
    git(p.path, ['log', `--since=${WEEKS * 7 + 7}.days`, '--no-merges', '--format=%x1e%at%x1f%ae', '--shortstat'], 15_000),
    git(p.path, ['log', '-1', '--format=%at'])
  ])
  return {
    ...base,
    commits: log.ok ? parseGitLog(log.stdout) : [],
    lastCommitAt: last.ok && /^\d+/.test(last.stdout.trim()) ? Number(last.stdout.trim()) : null,
    branch: details.branch, ahead: details.ahead, behind: details.behind
  }
}

export async function getActivity(fresh = false): Promise<ActivityData> {
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache
  // A group's projects share its repository: the group stands for them
  const projects = loadProjects()
  const out: ProjectActivity[] = []
  for (let i = 0; i < projects.length; i += PARALLEL) out.push(...await Promise.all(projects.slice(i, i + PARALLEL).map(one)))
  const email = await runFile('git', ['config', '--global', 'user.email'], { timeout: 5000 })
  cache = { me: email.ok ? email.stdout.trim().toLowerCase() || null : null, projects: out, at: Date.now() }
  return cache
}
