import type { DbTableRef, DbType } from '../types'
import { quoteColumn, quoteIdent } from './sqlQuote'

/**
 * v3.6 lot 3: the rows of a table changed from the Browse tab. Values always
 * travel as parameters; the SQL shown to the user inlines them, for reading only.
 */

export type RowValues = Record<string, string | number | boolean | null>

export type RowChange =
  /** `key`: the primary key's columns and values of the row as it was read */
  | { kind: 'update'; key: RowValues; set: RowValues }
  | { kind: 'insert'; values: RowValues }
  | { kind: 'delete'; key: RowValues }

export interface RowStatement { sql: string; params: (string | number | boolean | null)[] }

/** At most this many changes in one Apply */
export const MAX_ROW_CHANGES = 500

const placeholder = (db: DbType, n: number) => (db === 'postgres' ? `$${n}` : '?')

function where(db: DbType, key: RowValues, params: RowStatement['params']): string {
  return Object.entries(key).map(([col, v]) => {
    if (v === null) return `${quoteColumn(db, col)} IS NULL`
    params.push(v)
    return `${quoteColumn(db, col)} = ${placeholder(db, params.length)}`
  }).join(' AND ')
}

export function rowStatements(db: DbType, table: DbTableRef, changes: RowChange[]): RowStatement[] {
  const t = quoteIdent(db, table)
  return changes.flatMap((c): RowStatement[] => {
    const params: RowStatement['params'] = []
    if (c.kind === 'update') {
      const cols = Object.entries(c.set)
      if (!cols.length) return []
      const set = cols.map(([col, v]) => { params.push(v); return `${quoteColumn(db, col)} = ${placeholder(db, params.length)}` }).join(', ')
      return [{ sql: `UPDATE ${t} SET ${set} WHERE ${where(db, c.key, params)}`, params }]
    }
    if (c.kind === 'delete') return [{ sql: `DELETE FROM ${t} WHERE ${where(db, c.key, params)}`, params }]
    const cols = Object.entries(c.values)
    if (!cols.length) return [{ sql: db === 'mysql' ? `INSERT INTO ${t} () VALUES ()` : `INSERT INTO ${t} DEFAULT VALUES`, params }]
    const names = cols.map(([col]) => quoteColumn(db, col)).join(', ')
    const values = cols.map(([, v]) => { params.push(v); return placeholder(db, params.length) }).join(', ')
    return [{ sql: `INSERT INTO ${t} (${names}) VALUES (${values})`, params }]
  })
}

const literal = (v: RowStatement['params'][number]) =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : `'${String(v).replace(/'/g, "''")}'`

/** The statement as it reads, values in place (shown before Apply; never run) */
export function previewStatement(db: DbType, s: RowStatement): string {
  if (db === 'postgres') return s.sql.replace(/\$(\d+)/g, (_, n: string) => literal(s.params[Number(n) - 1]))
  let i = 0
  return s.sql.replace(/\?/g, () => literal(s.params[i++]))
}

/** What is wrong with the changes, checked against the table: unknown columns, a key that is not the primary key */
export function rowChangesProblem(changes: RowChange[], columns: string[], primaryKey: string[]): string | null {
  if (!primaryKey.length) return 'This table has no primary key: its rows cannot be told apart'
  if (changes.length > MAX_ROW_CHANGES) return `${MAX_ROW_CHANGES} changes at most at once`
  const known = new Set(columns)
  for (const c of changes) {
    const used = c.kind === 'update' ? [...Object.keys(c.key), ...Object.keys(c.set)] : c.kind === 'delete' ? Object.keys(c.key) : Object.keys(c.values)
    const bad = used.find(col => !known.has(col))
    if (bad) return `Unknown column: ${bad}`
    if (c.kind !== 'insert') {
      const keys = Object.keys(c.key).sort()
      if (keys.join('\n') !== [...primaryKey].sort().join('\n')) return 'A row must be named by its whole primary key'
    }
  }
  return null
}
