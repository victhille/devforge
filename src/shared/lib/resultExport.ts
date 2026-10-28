import type { DbQueryResult } from '../types'

export type ResultFormat = 'csv' | 'json'

/** CSV with RFC 4180 quoting */
export function toCsv(r: Pick<DbQueryResult, 'columns' | 'rows'>): string {
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [r.columns.map(q).join(','), ...r.rows.map(row => row.map(q).join(','))].join('\n')
}

/**
 * v3.5.1: one object per row, keyed by column. A repeated column name (a join
 * without aliases) gets a suffix, `id_2`, so no value is lost.
 */
export function toJson(r: Pick<DbQueryResult, 'columns' | 'rows'>): string {
  const seen = new Map<string, number>()
  const keys = r.columns.map(c => {
    const n = (seen.get(c) ?? 0) + 1
    seen.set(c, n)
    return n === 1 ? c : `${c}_${n}`
  })
  const objects = r.rows.map(row => Object.fromEntries(keys.map((k, i) => [k, row[i] ?? null])))
  return JSON.stringify(objects, (_k, v) => (typeof v === 'bigint' ? v.toString() : v), 2)
}

export const formatResult = (r: Pick<DbQueryResult, 'columns' | 'rows'>, format: ResultFormat) =>
  format === 'json' ? toJson(r) : toCsv(r)
