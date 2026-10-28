import type { ActivityCommit, ProjectActivity } from '../types/activity'

/**
 * v3.8 lot 3: the Activity page's figures, from each project's commits:
 * commits per week, the most active, those asleep, the branches to follow.
 */

export const WEEKS = 12
const WEEK = 7 * 24 * 3600

/** `git log --format=%x1e%at%x1f%ae --shortstat`: one commit per record */
export function parseGitLog(out: string): ActivityCommit[] {
  return out.split('\x1e').map(s => s.trim()).filter(Boolean).flatMap(rec => {
    const [head, ...rest] = rec.split('\n')
    const [at, email] = head.split('\x1f')
    if (!/^\d+$/.test(at ?? '')) return []
    const stat = rest.join(' ')
    return [{ at: Number(at), email: (email ?? '').trim().toLowerCase(), added: Number(stat.match(/(\d+) insertions?/)?.[1] ?? 0), removed: Number(stat.match(/(\d+) deletions?/)?.[1] ?? 0) }]
  })
}

/** The Monday 00:00 (local) of a week, as Unix seconds */
export function weekStart(atSeconds: number): number {
  const d = new Date(atSeconds * 1000)
  const day = (d.getDay() + 6) % 7
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return Math.floor(d.getTime() / 1000)
}

export interface WeekBar { start: number; byProject: Record<string, number>; total: number }

/** The last `WEEKS` weeks, oldest first, each project's commits in them */
export function commitsByWeek(projects: Pick<ProjectActivity, 'id' | 'commits'>[], nowSeconds: number, keep: (c: ActivityCommit) => boolean = () => true): WeekBar[] {
  const last = weekStart(nowSeconds)
  const weeks: WeekBar[] = Array.from({ length: WEEKS }, (_, i) => ({ start: last - (WEEKS - 1 - i) * WEEK, byProject: {}, total: 0 }))
  for (const p of projects) {
    for (const c of p.commits) {
      if (!keep(c)) continue
      const i = Math.round((weekStart(c.at) - weeks[0].start) / WEEK)
      if (i < 0 || i >= WEEKS) continue
      weeks[i].byProject[p.id] = (weeks[i].byProject[p.id] ?? 0) + 1
      weeks[i].total++
    }
  }
  return weeks
}

export interface ActiveProject { id: string; name: string; commits: number; added: number; removed: number }

/** The most active over the last `days` days */
export function mostActive(projects: ProjectActivity[], nowSeconds: number, days = 30, keep: (c: ActivityCommit) => boolean = () => true): ActiveProject[] {
  const since = nowSeconds - days * 24 * 3600
  return projects.map(p => {
    const recent = p.commits.filter(c => c.at >= since && keep(c))
    return { id: p.id, name: p.name, commits: recent.length, added: recent.reduce((n, c) => n + c.added, 0), removed: recent.reduce((n, c) => n + c.removed, 0) }
  }).filter(p => p.commits > 0).sort((a, b) => b.commits - a.commits || b.added - a.added)
}

/** No commit for `days` days (a repository that has commits) */
export const asleep = (projects: ProjectActivity[], nowSeconds: number, days = 90) =>
  projects.filter(p => p.lastCommitAt !== null && p.lastCommitAt < nowSeconds - days * 24 * 3600).sort((a, b) => (a.lastCommitAt ?? 0) - (b.lastCommitAt ?? 0))

/** Commits to push or to pull */
export const toFollow = (projects: ProjectActivity[]) => projects.filter(p => p.ahead > 0 || p.behind > 0)
