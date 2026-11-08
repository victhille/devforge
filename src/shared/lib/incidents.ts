import type { MonitorIncident } from '../types/monitor'

/** An incident is kept this many days after it ended, and at most this many (a URL that flaps every check) */
export const INCIDENT_DAYS = 30
export const MAX_INCIDENTS = 500
const DAY_MS = 86_400_000

/**
 * The incidents of a watched URL after a check: one opens when the URL goes
 * down, the open one closes when it answers again; those that ended more than
 * 30 days ago are dropped. Most recent first.
 */
export function trackIncidents(list: MonitorIncident[] | undefined, ok: boolean, at: string): MonitorIncident[] {
  const now = Date.parse(at)
  let out = (Array.isArray(list) ? list : []).filter(i => i.end === null || now - Date.parse(i.end) <= INCIDENT_DAYS * DAY_MS)
  const open = out.find(i => i.end === null)
  if (!ok && !open) out = [{ start: at, end: null }, ...out]
  if (ok && open) out = out.map(i => (i === open ? { ...i, end: at } : i))
  return out.slice(0, MAX_INCIDENTS)
}

/** How many incidents started in the last 30 days, and how long they lasted (an open one counts until now) */
export function incidentSummary(lists: (MonitorIncident[] | undefined)[], now = Date.now()): { count: number; downMs: number } {
  const since = now - INCIDENT_DAYS * DAY_MS
  let count = 0
  let downMs = 0
  for (const list of lists) {
    for (const i of list ?? []) {
      const start = Date.parse(i.start)
      const end = i.end === null ? now : Date.parse(i.end)
      if (end < since) continue
      if (start >= since) count++
      downMs += Math.max(0, end - Math.max(start, since))
    }
  }
  return { count, downMs }
}

/** A downtime in words: 12 min, 2 h 05, 3 j 4 h (`day` is the short day unit of the interface language) */
export function formatDowntime(ms: number, day: string): string {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ${String(min % 60).padStart(2, '0')}` : `${Math.floor(h / 24)} ${day} ${h % 24} h`
}
