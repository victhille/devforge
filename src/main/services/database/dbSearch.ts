import type { DbTableRef } from '@shared/types'
import { quoteIdent } from '@shared/lib/sqlQuote'
import { DB_SEARCH_MAX_ROWS, DB_SEARCH_MODES, searchProblem, searchStatements, searchedColumns, type DbSearchOptions, type DbSearchResult } from '@shared/lib/dbSearch'
import { closeDb, connOf, driverFor } from './dbClient'

/**
 * The Search tab, one table at a time (the page shows each as it comes and can
 * stop between two): its matching rows up to the limit, and how many there are.
 * Read only; the term only ever goes in as a parameter.
 */
export async function dbSearchTable(id: string, t: DbTableRef, raw: DbSearchOptions): Promise<DbSearchResult> {
  const start = Date.now()
  const o: DbSearchOptions = {
    term: String(raw?.term ?? ''),
    mode: DB_SEARCH_MODES.includes(raw?.mode) ? raw.mode : 'contains',
    caseSensitive: raw?.caseSensitive === true,
    column: typeof raw?.column === 'string' ? raw.column : '',
    limit: Math.min(Math.max(Math.floor(Number(raw?.limit)) || 50, 1), DB_SEARCH_MAX_ROWS)
  }
  const ref = { name: String(t?.name ?? ''), schema: String(t?.schema ?? '') }
  const empty = { columns: [], rows: [], total: 0 }
  const problem = searchProblem(o)
  if (problem) return { ...empty, durationMs: 0, error: typeof problem === 'string' ? problem : problem.regex }
  const c = connOf(id)
  try {
    const d = await driverFor(id)
    // The table's columns, from the table itself (no rows read)
    const head = await d.rows(`SELECT * FROM ${quoteIdent(c.type, ref)} LIMIT 0`, [])
    const columns = searchedColumns(head.columns, o.column)
    if (!columns.length) return { ...empty, columns: head.columns, durationMs: Date.now() - start, skipped: true }
    const q = searchStatements(c.type, ref, columns, o)
    const regexp = o.mode === 'regex'
    const found = await d.rows(q.rows.sql, q.rows.params, { regexp })
    const total = found.rows.length < o.limit ? found.rows.length : Number((await d.rows(q.count.sql, q.count.params, { regexp })).rows[0]?.[0])
    return { columns: found.columns, rows: found.rows, total, durationMs: Date.now() - start }
  } catch (err) {
    if (/closed|terminated|ECONNRESET|Connection lost|timeout/i.test(String(err))) await closeDb(id)
    return { ...empty, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}
