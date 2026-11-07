// What the archive workflow (scripts/stats-archive.mjs) and the /admin page
// both do with GitHub's numbers. Plain JavaScript: the page loads it as is.

/** Installers: new installs, and the updates that fetch the whole file */
const INSTALLER = /\.(exe|msi|dmg|pkg|appimage|deb|rpm|snap)$/i
/** The update feed: each launch of an installed copy reads it once while its release is the newest */
const UPDATE_FEED = /^latest(-\w+)?\.yml$/i

/** Downloads per published release, newest first */
export function releaseCounts(releases) {
  return releases.filter(r => !r.draft).map(r => {
    const sum = re => r.assets.filter(a => re.test(a.name)).reduce((n, a) => n + a.download_count, 0)
    return { tag: r.tag_name, publishedAt: r.published_at, downloads: sum(INSTALLER), updateChecks: sum(UPDATE_FEED) }
  })
}

/**
 * The archived days with GitHub's last 14 laid over them: a day GitHub still
 * has wins, the archive may have caught it unfinished. Returns a new map.
 */
export function mergeDays(archived, views, clones) {
  const days = { ...(archived ?? {}) }
  const day = date => days[date] ?? { views: 0, uniques: 0, clones: 0, cloneUniques: 0 }
  for (const v of views ?? []) { const date = v.timestamp.slice(0, 10); days[date] = { ...day(date), views: v.count, uniques: v.uniques } }
  for (const c of clones ?? []) { const date = c.timestamp.slice(0, 10); days[date] = { ...day(date), clones: c.count, cloneUniques: c.uniques } }
  return Object.fromEntries(Object.entries(days).sort(([a], [b]) => a.localeCompare(b)))
}

/** The archive after one more day: traffic merged, today's counts kept, the 14-day lists replaced */
export function nextArchive(archive, live, today) {
  const releases = releaseCounts(live.releases)
  const days = mergeDays(archive?.days, live.views?.views, live.clones?.clones)
  return {
    since: archive?.since ?? Object.keys(days)[0] ?? today,
    days,
    snapshots: {
      ...(archive?.snapshots ?? {}),
      [today]: {
        stars: live.repo.stargazers_count,
        forks: live.repo.forks_count,
        downloads: releases.reduce((n, r) => n + r.downloads, 0),
        updateChecks: releases.reduce((n, r) => n + r.updateChecks, 0)
      }
    },
    releases,
    referrers: live.referrers ?? [],
    paths: live.paths ?? [],
    updatedAt: live.at
  }
}
