import { readFile, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import mysql from 'mysql2/promise'
import pg from 'pg'
import initSqlJs, { type Database as SqlJsDb, type SqlJsStatic } from 'sql.js'
import type { DbConnection, DbQueryResult, DbTable } from '@shared/types'
import { getDbConnection } from './dbStorage'

const ROW_LIMIT = 1000
const TIMEOUT_MS = 15_000

// ─── Drivers ──────────────────────────────────────────────────────────────────

interface Driver {
  version(): Promise<string>
  schema(): Promise<DbTable[]>
  query(sql: string): Promise<Omit<DbQueryResult, 'durationMs'>>
  close(): Promise<void>
}

function limitRows(rows: unknown[][]): { rows: unknown[][]; truncated: boolean } {
  return rows.length > ROW_LIMIT ? { rows: rows.slice(0, ROW_LIMIT), truncated: true } : { rows, truncated: false }
}

/** Dates, buffers and bigints are not structured-clone friendly in every form: normalize */
function cell(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'bigint') return v.toString()
  if (v instanceof Uint8Array) return `<binary ${v.length} bytes>`
  if (v !== null && typeof v === 'object') return JSON.stringify(v)
  return v
}

async function mysqlDriver(c: DbConnection): Promise<Driver> {
  const conn = await mysql.createConnection({
    host: c.host, port: c.port ?? 3306, user: c.user, password: c.password, database: c.database,
    connectTimeout: TIMEOUT_MS, multipleStatements: false, dateStrings: true
  })
  return {
    async version() { const [r] = await conn.query('SELECT VERSION() AS v'); return `MySQL ${(r as { v: string }[])[0].v}` },
    async schema() {
      const [cols] = await conn.query(
        `SELECT c.TABLE_NAME t, c.COLUMN_NAME n, c.COLUMN_TYPE ty, c.IS_NULLABLE nu, c.COLUMN_KEY k, tb.TABLE_TYPE tt
         FROM information_schema.COLUMNS c JOIN information_schema.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME
         WHERE c.TABLE_SCHEMA = DATABASE() ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`)
      const map = new Map<string, DbTable>()
      for (const r of cols as { t: string; n: string; ty: string; nu: string; k: string; tt: string }[]) {
        if (!map.has(r.t)) map.set(r.t, { name: r.t, schema: '', type: r.tt === 'VIEW' ? 'view' : 'table', columns: [] })
        map.get(r.t)!.columns.push({ name: r.n, type: r.ty, nullable: r.nu === 'YES', key: r.k === 'PRI' })
      }
      return [...map.values()]
    },
    async query(sql) {
      const [result, fields] = await conn.query({ sql, rowsAsArray: true, timeout: 60_000 })
      if (!Array.isArray(result)) return { columns: [], rows: [], affected: (result as { affectedRows: number }).affectedRows, truncated: false }
      const { rows, truncated } = limitRows((result as unknown[][]).map(r => r.map(cell)))
      return { columns: (fields ?? []).map(f => f.name), rows, affected: null, truncated }
    },
    close: () => conn.end()
  }
}

async function postgresDriver(c: DbConnection): Promise<Driver> {
  const client = new pg.Client({
    host: c.host, port: c.port ?? 5432, user: c.user, password: c.password, database: c.database,
    connectionTimeoutMillis: TIMEOUT_MS, statement_timeout: 60_000
  })
  await client.connect()
  return {
    async version() { const r = await client.query('SHOW server_version'); return `PostgreSQL ${r.rows[0].server_version}` },
    async schema() {
      const r = await client.query(
        `SELECT c.table_schema s, c.table_name t, c.column_name n, c.data_type ty, c.is_nullable nu, t.table_type tt,
                EXISTS (SELECT 1 FROM information_schema.key_column_usage k JOIN information_schema.table_constraints tc
                        ON tc.constraint_name = k.constraint_name AND tc.constraint_type = 'PRIMARY KEY'
                        WHERE k.table_schema = c.table_schema AND k.table_name = c.table_name AND k.column_name = c.column_name) pk
         FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
         WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY c.table_schema, c.table_name, c.ordinal_position`)
      const map = new Map<string, DbTable>()
      for (const row of r.rows) {
        const key = `${row.s}.${row.t}`
        if (!map.has(key)) map.set(key, { name: row.t, schema: row.s, type: row.tt === 'VIEW' ? 'view' : 'table', columns: [] })
        map.get(key)!.columns.push({ name: row.n, type: row.ty, nullable: row.nu === 'YES', key: row.pk })
      }
      return [...map.values()]
    },
    async query(sql) {
      const r = await client.query({ text: sql, rowMode: 'array' })
      const res = Array.isArray(r) ? r[r.length - 1] : r
      if (!res.fields?.length) return { columns: [], rows: [], affected: res.rowCount ?? null, truncated: false }
      const { rows, truncated } = limitRows((res.rows as unknown[][]).map(row => row.map(cell)))
      return { columns: res.fields.map((f: { name: string }) => f.name), rows, affected: null, truncated }
    },
    close: () => client.end()
  }
}

let SQL: SqlJsStatic | null = null

async function sqliteDriver(c: DbConnection): Promise<Driver> {
  if (!c.file) throw new Error('No SQLite file')
  if (!SQL) {
    // Locate the wasm next to the sql.js package (works in dev and packaged)
    const wasmDir = dirname(createRequire(__filename).resolve('sql.js/dist/sql-wasm.wasm'))
    SQL = await initSqlJs({ locateFile: f => join(wasmDir, f) })
  }
  const file = c.file
  const db: SqlJsDb = new SQL.Database(await readFile(file))
  return {
    async version() { return `SQLite ${db.exec('select sqlite_version()')[0].values[0][0]}` },
    async schema() {
      const objs = db.exec(`SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name`)[0]?.values ?? []
      return objs.map(([name, type]) => {
        const info = db.exec(`PRAGMA table_info("${String(name).replace(/"/g, '""')}")`)[0]?.values ?? []
        return {
          name: String(name), schema: '', type: type === 'view' ? 'view' : 'table',
          columns: info.map(col => ({ name: String(col[1]), type: String(col[2]), nullable: col[3] === 0, key: Number(col[5]) > 0 }))
        } as DbTable
      })
    },
    async query(sql) {
      const before = db.getRowsModified()
      const results = db.exec(sql)
      const changed = db.getRowsModified() - before
      // sql.js works in memory: persist writes back to the file
      if (changed > 0 || /^\s*(create|drop|alter|insert|update|delete|replace|vacuum)/i.test(sql)) {
        await writeFile(file, db.export())
      }
      const last = results[results.length - 1]
      if (!last) return { columns: [], rows: [], affected: changed, truncated: false }
      const { rows, truncated } = limitRows(last.values.map(r => r.map(cell)))
      return { columns: last.columns, rows, affected: null, truncated }
    },
    async close() { db.close() }
  }
}

function open(c: DbConnection): Promise<Driver> {
  switch (c.type) {
    case 'mysql':    return mysqlDriver(c)
    case 'postgres': return postgresDriver(c)
    case 'sqlite':   return sqliteDriver(c)
  }
}

// ─── Connection pool (one open driver per saved connection) ─────────────────

const open$ = new Map<string, Promise<Driver>>()

function driverFor(id: string): Promise<Driver> {
  let d = open$.get(id)
  if (!d) {
    const c = getDbConnection(id)
    if (!c) throw new Error('Unknown connection')
    d = open(c)
    d.catch(() => open$.delete(id))
    open$.set(id, d)
  }
  return d
}

export async function closeDb(id: string): Promise<void> {
  const d = open$.get(id)
  open$.delete(id)
  if (d) await (await d.catch(() => null))?.close().catch(() => {})
}

export async function closeAllDbs(): Promise<void> {
  await Promise.all([...open$.keys()].map(closeDb))
}

/** Test unsaved settings; password falls back to the stored one */
export async function testDb(c: DbConnection): Promise<string> {
  const full = { ...c, password: c.password || getDbConnection(c.id)?.password }
  const d = await open(full)
  try { return await d.version() } finally { await d.close().catch(() => {}) }
}

export async function dbSchema(id: string): Promise<DbTable[]> {
  return (await driverFor(id)).schema()
}

export async function dbQuery(id: string, sql: string): Promise<DbQueryResult> {
  const start = Date.now()
  try {
    const r = await (await driverFor(id)).query(sql)
    return { ...r, durationMs: Date.now() - start }
  } catch (err) {
    // A broken connection must be reopened next time
    if (/closed|terminated|ECONNRESET|Connection lost/i.test(String(err))) await closeDb(id)
    return { columns: [], rows: [], affected: null, truncated: false, durationMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) }
  }
}
