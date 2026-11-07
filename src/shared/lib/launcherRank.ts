/** How often and how lately each launcher entry was chosen */
export type LauncherUsage = Record<string, { n: number; last: number }>

export interface Rankable {
  id: string
  title: string
  subtitle?: string
  keywords?: string
  group?: string
}

const DAY = 86_400_000
/** At most this many entries remembered */
const MAX_USAGE = 300

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function recordUse(usage: LauncherUsage, id: string, now = Date.now()): LauncherUsage {
  const next = { ...usage, [id]: { n: (usage[id]?.n ?? 0) + 1, last: now } }
  const ids = Object.keys(next)
  if (ids.length <= MAX_USAGE) return next
  ids.sort((a, b) => next[a].last - next[b].last)
  for (const old of ids.slice(0, ids.length - MAX_USAGE)) delete next[old]
  return next
}

/** Uses, halved every week without one */
const frecency = (u: LauncherUsage[string] | undefined, now: number) => u ? u.n * 0.5 ** ((now - u.last) / (7 * DAY)) : 0

/** Every word must match; title starts and frequent use rank higher */
function textScore(e: Rankable, words: string[]): number {
  const title = normalize(e.title)
  const hay = `${title} ${normalize(e.subtitle ?? '')} ${normalize(e.keywords ?? '')} ${normalize(e.group ?? '')}`
  let score = 0
  for (const w of words) {
    if (!hay.includes(w)) return 0
    score += title.startsWith(w) ? 3 : title.includes(` ${w}`) ? 2 : title.includes(w) ? 1.5 : 0.5
  }
  return score
}

/**
 * Matching entries, best first. With an empty query: what was used, most
 * used lately first.
 */
export function rankEntries<T extends Rankable>(entries: T[], query: string, usage: LauncherUsage, now = Date.now()): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  if (!words.length) {
    return entries.filter(e => usage[e.id]).sort((a, b) => frecency(usage[b.id], now) - frecency(usage[a.id], now))
  }
  return entries
    .map(e => ({ e, s: textScore(e, words) }))
    .filter(x => x.s > 0)
    .map(x => ({ e: x.e, s: x.s + Math.min(3, 1.5 * Math.log2(1 + frecency(usage[x.e.id], now))) }))
    .sort((a, b) => b.s - a.s)
    .map(x => x.e)
}
