import { describe, expect, it } from 'vitest'
import { mergeDays, nextArchive, releaseCounts } from '../../site/public/admin/stats-core.js'

const release = (tag: string, assets: [string, number][], draft = false) => ({
  tag_name: tag, published_at: '2026-10-30T10:00:00Z', draft, assets: assets.map(([name, download_count]) => ({ name, download_count }))
})
const count = (date: string, n: number, u: number) => ({ timestamp: `${date}T00:00:00Z`, count: n, uniques: u })

describe('releaseCounts', () => {
  it('counts the installers and the update feed apart, and leaves the blockmap and the drafts out', () => {
    expect(releaseCounts([
      release('v3.9.0', [['DevForge-Setup-v3.9.0.exe', 12], ['DevForge-Setup-v3.9.0.exe.blockmap', 5], ['latest.yml', 40]]),
      release('v4.0.0', [['DevForge-Setup-v4.0.0.exe', 99]], true)
    ])).toEqual([{ tag: 'v3.9.0', publishedAt: '2026-10-30T10:00:00Z', downloads: 12, updateChecks: 40 }])
  })
})

describe('mergeDays', () => {
  it('keeps the archived days and lets GitHub correct the ones it still has', () => {
    const archived = { '2026-10-01': { views: 3, uniques: 2, clones: 1, cloneUniques: 1 }, '2026-10-20': { views: 1, uniques: 1, clones: 0, cloneUniques: 0 } }
    expect(mergeDays(archived, [count('2026-10-20', 8, 4), count('2026-10-21', 5, 3)], [count('2026-10-21', 2, 1)])).toEqual({
      '2026-10-01': { views: 3, uniques: 2, clones: 1, cloneUniques: 1 },
      '2026-10-20': { views: 8, uniques: 4, clones: 0, cloneUniques: 0 },
      '2026-10-21': { views: 5, uniques: 3, clones: 2, cloneUniques: 1 }
    })
  })
})

describe('nextArchive', () => {
  const live = {
    repo: { stargazers_count: 7, forks_count: 1 },
    releases: [release('v3.9.0', [['DevForge-Setup-v3.9.0.exe', 12], ['latest.yml', 40]])],
    views: { views: [count('2026-10-30', 5, 2)] },
    clones: { clones: [] },
    referrers: [{ referrer: 'github.com', count: 4, uniques: 2 }],
    paths: [],
    at: '2026-10-31T03:17:00Z'
  }

  it('starts an archive, then adds a day without losing the ones before', () => {
    const first = nextArchive(null, live, '2026-10-31')
    expect(first.since).toBe('2026-10-30')
    expect(first.snapshots).toEqual({ '2026-10-31': { stars: 7, forks: 1, downloads: 12, updateChecks: 40 } })
    const second = nextArchive(first, { ...live, repo: { stargazers_count: 9, forks_count: 1 }, views: { views: [count('2026-10-31', 6, 6)] } }, '2026-11-01')
    expect(second.since).toBe('2026-10-30')
    expect(Object.keys(second.days)).toEqual(['2026-10-30', '2026-10-31'])
    expect(second.snapshots['2026-10-31'].stars).toBe(7)
    expect(second.snapshots['2026-11-01'].stars).toBe(9)
    expect(second.referrers).toEqual([{ referrer: 'github.com', count: 4, uniques: 2 }])
  })
})
