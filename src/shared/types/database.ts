// ─── Database client ─────────────────────────────────────────────────────────

export type DbType = 'mysql' | 'postgres' | 'sqlite'

export interface DbConnection {
  id: string
  name: string
  type: DbType
  host?: string
  port?: number
  user?: string
  database?: string
  /** SQLite file */
  file?: string
  /** Write-only, encrypted at rest; never returned to the renderer */
  password?: string
  hasPassword?: boolean
  color: string
}

export interface DbTable {
  name: string
  /** schema for postgres, empty otherwise */
  schema: string
  type: 'table' | 'view'
  columns: { name: string; type: string; nullable: boolean; key: boolean }[]
}

export interface DbQueryResult {
  columns: string[]
  rows: unknown[][]
  /** Rows affected for INSERT/UPDATE/DELETE */
  affected: number | null
  /** true when rows were cut at the limit */
  truncated: boolean
  durationMs: number
  error?: string
}

export interface DatabaseAPI {
  list:   () => Promise<DbConnection[]>
  save:   (c: DbConnection) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Connects and returns the server version, throws on failure */
  test:   (c: DbConnection) => Promise<string>
  schema: (id: string) => Promise<DbTable[]>
  query:  (id: string, sql: string) => Promise<DbQueryResult>
}
