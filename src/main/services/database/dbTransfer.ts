import { createWriteStream } from 'fs'
import { readFile, stat, writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { dialog, type BrowserWindow } from 'electron'
import type { CsvPreview, DbTableRef, ExportFormat } from '@shared/types'
import { quoteColumn, quoteIdent } from '@shared/lib/sqlQuote'
import { previewStatement, rowStatements, type RowValues } from '@shared/lib/rowEdits'
import { toCsv } from '@shared/lib/resultExport'
import { decodeCsv, guessSeparator, matchColumns, parseCsv } from '@shared/lib/csvImport'
import { closeDb, connOf, dbDetails, driverFor } from './dbClient'

/**
 * v3.6 lot 4: a table exported to a file (CSV, JSON or SQL), page by page so
 * a large one never sits whole in memory; a CSV imported into a table in one
 * transaction. Files go through Windows' dialogs: the window never names a path.
 */

const PAGE = 1000
const IMPORT_MAX_BYTES = 50 * 1024 * 1024
const EXT: Record<ExportFormat, string> = { csv: 'csv', json: 'json', sql: 'sql', 'sql-create': 'sql' }

/** A CREATE TABLE from the columns, when the database gives no DDL of its own */
function createFrom(type: Parameters<typeof quoteIdent>[0], t: DbTableRef, columns: { name: string; type: string; nullable: boolean; key: string }[]): string {
  const keys = columns.filter(c => c.key === 'PRI').map(c => quoteColumn(type, c.name))
  const lines = columns.map(c => `  ${quoteColumn(type, c.name)} ${c.type}${c.nullable ? '' : ' NOT NULL'}`)
  if (keys.length) lines.push(`  PRIMARY KEY (${keys.join(', ')})`)
  return `CREATE TABLE ${quoteIdent(type, t)} (\n${lines.join(',\n')}\n);`
}

export async function exportTable(win: BrowserWindow, id: string, t: DbTableRef, format: ExportFormat): Promise<{ path: string; rows: number } | null> {
  const c = connOf(id)
  const pick = await dialog.showSaveDialog(win, { defaultPath: `${t.name}.${EXT[format]}`, filters: [{ name: format.toUpperCase(), extensions: [EXT[format]] }] })
  if (pick.canceled || !pick.filePath) return null
  const details = await dbDetails(id, t)
  const driver = await driverFor(id)
  // A stable order, so pages neither skip nor repeat rows
  const keys = details.columns.filter(x => x.key === 'PRI').map(x => quoteColumn(c.type, x.name))
  const order = keys.length ? ` ORDER BY ${keys.join(', ')}` : ''
  const out = createWriteStream(pick.filePath, { encoding: 'utf-8' })
  const write = (s: string) => new Promise<void>((res, rej) => out.write(s, err => (err ? rej(err) : res())))
  let rows = 0
  try {
    if (format === 'sql-create') await write(`${details.ddl ? details.ddl.replace(/;?\s*$/, ';') : createFrom(c.type, t, details.columns)}\n\n`)
    if (format === 'json') await write('[')
    for (let offset = 0; ; offset += PAGE) {
      const page = await driver.query(`SELECT * FROM ${quoteIdent(c.type, t)}${order} LIMIT ${PAGE} OFFSET ${offset}`)
      if (format === 'csv') await write(offset === 0 ? toCsv(page) : page.rows.length ? `\n${toCsv({ columns: page.columns, rows: page.rows }).split('\n').slice(1).join('\n')}` : '')
      else if (format === 'json') {
        const objects = page.rows.map(r => JSON.stringify(Object.fromEntries(page.columns.map((col, i) => [col, r[i] ?? null]))))
        if (objects.length) await write(`${rows ? ',' : ''}\n  ${objects.join(',\n  ')}`)
      } else {
        const inserts = rowStatements(c.type, t, page.rows.map(r => ({ kind: 'insert' as const, values: Object.fromEntries(page.columns.map((col, i) => [col, r[i] as RowValues[string]])) })))
        if (inserts.length) await write(inserts.map(s => `${previewStatement(c.type, s)};`).join('\n') + '\n')
      }
      rows += page.rows.length
      if (page.rows.length < PAGE) break
    }
    if (format === 'json') await write(rows ? '\n]\n' : ']\n')
  } finally {
    await new Promise<void>(res => out.end(() => res()))
  }
  return { path: pick.filePath, rows }
}

/** A query's result (what the SQL tab shows) saved as it is */
export async function saveResult(win: BrowserWindow, name: string, content: string, ext: 'csv' | 'json'): Promise<string | null> {
  const pick = await dialog.showSaveDialog(win, { defaultPath: `${name.replace(/[^\w.-]+/g, '_') || 'result'}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
  if (pick.canceled || !pick.filePath) return null
  const out = createWriteStream(pick.filePath, { encoding: 'utf-8' })
  await new Promise<void>((res, rej) => out.end(content, () => res()).on('error', rej))
  return pick.filePath
}

/** v3.8: the schema as an image; a PNG comes as a data URL */
export async function saveImage(win: BrowserWindow, name: string, content: string, ext: 'png' | 'svg'): Promise<string | null> {
  const pick = await dialog.showSaveDialog(win, { defaultPath: `${name.replace(/[^\w.-]+/g, '_') || 'schema'}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] })
  if (pick.canceled || !pick.filePath) return null
  const data = ext === 'png' ? Buffer.from(content.replace(/^data:image\/png;base64,/, ''), 'base64') : Buffer.from(content, 'utf-8')
  await writeFile(pick.filePath, data)
  return pick.filePath
}

// ─── Import ───────────────────────────────────────────────────────────────────

/** The CSVs picked, kept here: the window only holds a token */
const picked = new Map<string, { rows: string[][] }>()

export async function pickCsv(win: BrowserWindow, id: string, t: DbTableRef): Promise<CsvPreview | { error: string } | null> {
  const pick = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }] })
  if (pick.canceled || !pick.filePaths[0]) return null
  const path = pick.filePaths[0]
  if ((await stat(path)).size > IMPORT_MAX_BYTES) return { error: 'TOO_BIG' }
  const { text, encoding } = decodeCsv(await readFile(path))
  const separator = guessSeparator(text)
  const all = parseCsv(text, separator)
  if (all.length < 2) return { error: 'EMPTY' }
  const [headers, ...rows] = all
  const token = randomUUID()
  picked.set(token, { rows })
  const columns = (await dbDetails(id, t)).columns.map(c => c.name)
  return { token, name: path.split(/[\\/]/).pop()!, separator, encoding, headers, sample: rows.slice(0, 10), total: rows.length, mapping: matchColumns(headers, columns) }
}

/**
 * The picked CSV into the table, in one transaction. `mapping` gives each CSV
 * column's table column (null: left out); an empty cell is NULL when asked.
 * A failure names its CSV line (the header is line 1).
 */
export async function importCsv(id: string, t: DbTableRef, token: string, mapping: (string | null)[], emptyIsNull: boolean): Promise<{ inserted: number; error?: string; line?: number }> {
  const csv = picked.get(token)
  if (!csv) return { inserted: 0, error: 'The file is no longer picked: choose it again' }
  const c = connOf(id)
  const details = await dbDetails(id, t)
  if (details.stats?.type === 'view') return { inserted: 0, error: 'A view cannot be imported into' }
  const known = new Set(details.columns.map(x => x.name))
  const used = mapping.map((m, i) => [m, i] as const).filter((x): x is readonly [string, number] => !!x[0] && known.has(x[0]))
  if (!used.length) return { inserted: 0, error: 'No column matches the table' }
  const statements = rowStatements(c.type, t, csv.rows.map(r => ({
    kind: 'insert' as const,
    values: Object.fromEntries(used.map(([col, i]) => [col, (r[i] ?? '') === '' && emptyIsNull ? null : r[i] ?? '']))
  })))
  try {
    const inserted = await (await driverFor(id)).transaction(statements)
    picked.delete(token)
    return { inserted }
  } catch (err) {
    if (/closed|terminated|ECONNRESET|Connection lost/i.test(String(err))) await closeDb(id)
    const index = (err as { statementIndex?: number }).statementIndex
    return { inserted: 0, error: err instanceof Error ? err.message : String(err), ...(index !== undefined ? { line: index + 2 } : {}) }
  }
}
