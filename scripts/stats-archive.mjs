// Once a day (.github/workflows/stats.yml): GitHub keeps only 14 days of
// traffic, so the day's numbers are added to stats.json in the private
// repository the /admin page of the site reads. Nothing here is public.
//
//   STATS_TOKEN=… node scripts/stats-archive.mjs owner/repo path/to/stats.json
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { nextArchive } from '../site/public/admin/stats-core.js'

const [repo, file] = process.argv.slice(2)
const token = process.env.STATS_TOKEN
if (!repo || !file || !token) {
  console.error('Usage: STATS_TOKEN=… node scripts/stats-archive.mjs owner/repo stats.json')
  process.exit(1)
}

async function api(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'devforge-stats' }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status} on ${path || '/'}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const [info, releases, views, clones, referrers, paths] = await Promise.all([
  api(''), api('/releases?per_page=100'), api('/traffic/views'), api('/traffic/clones'), api('/traffic/popular/referrers'), api('/traffic/popular/paths')
])
const archive = existsSync(file) ? JSON.parse(readFileSync(file, 'utf-8')) : null
const now = new Date()
const next = nextArchive(archive, { repo: info, releases, views, clones, referrers, paths, at: now.toISOString() }, now.toISOString().slice(0, 10))
writeFileSync(file, `${JSON.stringify(next, null, 1)}\n`)
console.log(`${Object.keys(next.days).length} days archived since ${next.since}`)
