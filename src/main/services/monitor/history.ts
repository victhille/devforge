import { existsSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { HistorySeries } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'

/**
 * Time series for the monitoring charts (one point a minute, 7 days kept):
 * userData/history/<key>.json = { fields, rows: [time, ...values][] }.
 * Kept in memory and written every few minutes and on quit.
 */
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

interface Stored { fields: string[]; rows: (number | null)[][] }

const cache = new Map<string, Stored>()
const dirty = new Set<string>()

const safeKey = (key: string) => key.replace(/[^\w.-]/g, '_')
const pathOf = (key: string) => join(app.getPath('userData'), 'history', `${safeKey(key)}.json`)

function load(key: string): Stored | null {
  const hit = cache.get(key)
  if (hit) return hit
  if (!existsSync(pathOf(key))) return null
  try {
    const s = JSON.parse(readFileSync(pathOf(key), 'utf-8')) as Stored
    cache.set(key, s)
    return s
  } catch { return null }
}

/** Adds one point; older points than the retention go away */
export function appendPoint(key: string, fields: string[], values: (number | null)[], t = Date.now()): void {
  let s = load(key)
  // A changed set of fields starts a new series
  if (!s || s.fields.join() !== fields.join()) { s = { fields, rows: [] }; cache.set(key, s) }
  s.rows.push([t, ...values])
  const oldest = t - RETENTION_MS
  if (s.rows.length && (s.rows[0][0] as number) < oldest) s.rows = s.rows.filter(r => (r[0] as number) >= oldest)
  dirty.add(key)
}

/**
 * Points since `since`, averaged per `bucketMs` (missing values ignored):
 * a 0/1 "up" field becomes the share of time up in each bucket.
 */
export function readSeries(key: string, since: number, bucketMs: number): HistorySeries {
  const s = load(key)
  if (!s) return { fields: [], points: [] }
  const buckets = new Map<number, { sums: number[]; counts: number[] }>()
  for (const row of s.rows) {
    const t = row[0] as number
    if (t < since) continue
    const b = Math.floor(t / bucketMs) * bucketMs
    let acc = buckets.get(b)
    if (!acc) { acc = { sums: s.fields.map(() => 0), counts: s.fields.map(() => 0) }; buckets.set(b, acc) }
    s.fields.forEach((_, i) => {
      const v = row[i + 1]
      if (typeof v === 'number' && Number.isFinite(v)) { acc!.sums[i] += v; acc!.counts[i]++ }
    })
  }
  const points = [...buckets].sort(([a], [b]) => a - b).map(([t, acc]) => ({
    t, v: acc.sums.map((sum, i) => (acc.counts[i] ? Math.round((sum / acc.counts[i]) * 100) / 100 : null))
  }))
  return { fields: s.fields, points }
}

export function flushHistory(): void {
  for (const key of dirty) {
    const s = cache.get(key)
    if (s) { try { writeJsonFile(pathOf(key), s, false) } catch { /* next time */ } }
  }
  dirty.clear()
}

export function removeSeries(key: string): void {
  cache.delete(key)
  dirty.delete(key)
  rmSync(pathOf(key), { force: true })
}

let timer: ReturnType<typeof setInterval> | null = null
export function startHistoryFlush(): void {
  timer ??= setInterval(flushHistory, 5 * 60_000)
}
export function stopHistory(): void {
  if (timer) clearInterval(timer)
  timer = null
  flushHistory()
}
