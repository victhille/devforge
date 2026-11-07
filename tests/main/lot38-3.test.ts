import { describe, expect, it } from 'vitest'
import type { ProjectActivity } from '@shared/types'
import { asleep, commitsByWeek, mostActive, parseGitLog, parseHeadRef, toFollow, weekStart, WEEKS } from '@shared/lib/activity'

/** v3.8 lot 3: the Activity page's figures */

const DAY = 24 * 3600
// A Wednesday at noon (local)
const NOW = Math.floor(new Date(2026, 9, 28, 12).getTime() / 1000)
const proj = (id: string, commits: ProjectActivity['commits'], extra: Partial<ProjectActivity> = {}): ProjectActivity =>
  ({ id, name: id, path: `/p/${id}`, commits, lastCommitAt: commits.length ? Math.max(...commits.map(c => c.at)) : null, branch: 'main', ahead: 0, behind: 0, ...extra })
const c = (daysAgo: number, email = 'me@x.dev', added = 1, removed = 0) => ({ at: NOW - daysAgo * DAY, email, added, removed })

describe('parseGitLog', () => {
  it('reads each commit with its lines, merges and empty stats included', () => {
    const out = '\x1e1700000000\x1fMe@X.dev\n\n 2 files changed, 10 insertions(+), 3 deletions(-)\n\x1e1700000100\x1fother@x.dev\n\n 1 file changed, 1 insertion(+)\n\x1e1700000200\x1fme@x.dev\n'
    expect(parseGitLog(out)).toEqual([
      { at: 1700000000, email: 'me@x.dev', added: 10, removed: 3 },
      { at: 1700000100, email: 'other@x.dev', added: 1, removed: 0 },
      { at: 1700000200, email: 'me@x.dev', added: 0, removed: 0 }
    ])
    expect(parseGitLog('')).toEqual([])
    expect(parseGitLog('\x1enot-a-date\x1fa@b')).toEqual([])
  })
})

describe('parseHeadRef', () => {
  it('reads the checked-out branch, what it has to push or pull, its last commit', () => {
    const out = '  \tfeature\t\t1700000000\n*\tmain\tahead 2, behind 1\t1700000500\r\n  \told\tgone\t1600000000\n'
    expect(parseHeadRef(out)).toEqual({ branch: 'main', ahead: 2, behind: 1, lastCommitAt: 1700000500 })
    expect(parseHeadRef('*\tdev\t\t1700000000')).toEqual({ branch: 'dev', ahead: 0, behind: 0, lastCommitAt: 1700000000 })
    // Detached HEAD, or a repository without commits
    expect(parseHeadRef('  \tmain\t\t1700000000\n')).toBeNull()
    expect(parseHeadRef('')).toBeNull()
  })
})

describe('weeks', () => {
  it('starts a week on Monday at midnight', () => {
    const d = new Date(weekStart(NOW) * 1000)
    expect(d.getDay()).toBe(1)
    expect(d.getDate()).toBe(26)
    expect(d.getHours()).toBe(0)
  })

  it('counts the last 12 weeks per project, oldest first, filtered by author', () => {
    const weeks = commitsByWeek([proj('a', [c(0), c(1), c(8, 'other@x.dev')]), proj('b', [c(2), c(200)])], NOW)
    expect(weeks).toHaveLength(WEEKS)
    expect(weeks[WEEKS - 1]).toMatchObject({ total: 3, byProject: { a: 2, b: 1 } })
    expect(weeks[WEEKS - 2]).toMatchObject({ total: 1, byProject: { a: 1 } })
    expect(weeks.reduce((n, w) => n + w.total, 0)).toBe(4)
    const mine = commitsByWeek([proj('a', [c(0), c(8, 'other@x.dev')])], NOW, x => x.email === 'me@x.dev')
    expect(mine.reduce((n, w) => n + w.total, 0)).toBe(1)
  })
})

describe('the cards', () => {
  it('ranks the most active over 30 days, with their lines', () => {
    const r = mostActive([proj('a', [c(1, 'me@x.dev', 5, 2)]), proj('b', [c(1), c(2, 'me@x.dev', 3, 1), c(40)]), proj('c', [c(50)])], NOW)
    expect(r.map(p => p.id)).toEqual(['b', 'a'])
    expect(r[0]).toMatchObject({ commits: 2, added: 4, removed: 1 })
  })

  it('finds the projects asleep for 3 months, the oldest first, never a folder without Git', () => {
    const r = asleep([proj('a', [c(1)]), proj('b', [], { lastCommitAt: NOW - 100 * DAY }), proj('c', [], { lastCommitAt: NOW - 400 * DAY }), proj('d', [])], NOW)
    expect(r.map(p => p.id)).toEqual(['c', 'b'])
  })

  it('lists the branches to push or to pull', () => {
    expect(toFollow([proj('a', [], { ahead: 2 }), proj('b', []), proj('c', [], { behind: 1 })]).map(p => p.id)).toEqual(['a', 'c'])
  })
})
