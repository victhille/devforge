import type { RowChange } from '../lib/rowEdits'
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
  /** Reach host:port through this SSH connection (host as seen from the server) */
  sshConnectionId?: string
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

export interface DbTableRef { name: string; schema: string }

/** One table in the database overview (sizes and counts may be estimates) */
export interface DbTableStat extends DbTableRef {
  type: 'table' | 'view'
  rows: number | null
  dataBytes: number | null
  indexBytes: number | null
  engine?: string
  collation?: string
  comment?: string
}

export interface DbOverview {
  version: string
  database: string
  sizeBytes: number | null
  encoding?: string
  collation?: string
  tables: DbTableStat[]
}

export interface DbColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
  /** PRI primary key, UNI unique, MUL first column of a non-unique index */
  key: 'PRI' | 'UNI' | 'MUL' | ''
  /** auto_increment, identity, generated… */
  extra: string
  comment: string
}

export interface DbIndexInfo {
  name: string
  columns: string[]
  unique: boolean
  primary: boolean
  type: string
}

export interface DbForeignKey {
  name: string
  /** Referencing table (for "referenced by") or referenced table */
  table: string
  columns: string[]
  refColumns: string[]
  onUpdate: string
  onDelete: string
}

export interface DbTableDetails {
  columns: DbColumnInfo[]
  indexes: DbIndexInfo[]
  /** This table → other tables */
  foreignKeys: DbForeignKey[]
  /** Other tables → this table (`table` is the referencing one) */
  referencedBy: DbForeignKey[]
  ddl: string | null
  stats: DbTableStat | null
}

export interface DbBrowseOptions {
  offset: number
  limit: number
  orderBy?: string
  desc?: boolean
}

export interface DbBrowseResult extends DbQueryResult {
  /** Exact row count, null if it could not be computed */
  total: number | null
}

/** v3.6: a table's export formats ("sql-create": the CREATE TABLE first) */
export type ExportFormat = 'csv' | 'json' | 'sql' | 'sql-create'

/** v3.6: a CSV picked for import (the file itself stays in the main process) */
export interface CsvPreview {
  token: string
  name: string
  separator: ',' | ';' | '\t' | '|'
  encoding: string
  headers: string[]
  /** The first 10 rows */
  sample: string[][]
  total: number
  /** Each CSV column → its table column, or null (left out) */
  mapping: (string | null)[]
}

/** A database found on a server, ready to be added in one click */
export interface DetectedDatabase {
  /** Opaque key: credentials stay in the main process */
  key: string
  name: string
  type: 'mysql' | 'postgres'
  host: string
  port: number
  user?: string
  database?: string
  hasPassword: boolean
  source: 'docker' | 'native' | 'env'
  /** Container name, or the .env file it comes from */
  origin: string
  /** Already saved as a connection */
  exists: boolean
}

export interface DatabaseAPI {
  list:   () => Promise<DbConnection[]>
  save:   (c: DbConnection) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Connects and returns the server version, throws on failure */
  test:   (c: DbConnection) => Promise<string>
  schema: (id: string) => Promise<DbTable[]>
  query:  (id: string, sql: string) => Promise<DbQueryResult>
  /** Database info and every table with its size and row estimate */
  overview: (id: string) => Promise<DbOverview>
  /** Columns, indexes, foreign keys and DDL of one table */
  details: (id: string, table: DbTableRef) => Promise<DbTableDetails>
  /** One page of a table's rows */
  browse: (id: string, table: DbTableRef, opts: DbBrowseOptions) => Promise<DbBrowseResult>
  /** v3.6: the whole table into a file the user picks; null when cancelled */
  exportTable: (id: string, table: DbTableRef, format: ExportFormat) => Promise<{ path: string; rows: number } | null>
  /** v3.6: a query's result saved as it is */
  saveResult: (name: string, content: string, ext: 'csv' | 'json') => Promise<string | null>
  /** v3.6: a CSV picked and read; error TOO_BIG (over 50 MB) or EMPTY */
  pickCsv: (id: string, table: DbTableRef) => Promise<CsvPreview | { error: string } | null>
  /** v3.6: the picked CSV inserted, in one transaction; `line` is the CSV line that failed */
  importCsv: (id: string, table: DbTableRef, token: string, mapping: (string | null)[], emptyIsNull: boolean) => Promise<{ inserted: number; error?: string; line?: number }>
  /** v3.6: rows changed, in one transaction (all or none) */
  applyRows: (id: string, table: DbTableRef, changes: RowChange[]) => Promise<{ affected: number; error?: string }>
  /** Look for databases on a server (Docker containers + native services) */
  detectRemote: (sshConnectionId: string) => Promise<DetectedDatabase[]>
  /** Save a detected database as a connection, returns its id */
  addDetected: (key: string) => Promise<string>
  /** Databases described in the .env files of saved projects */
  detectLocal: () => Promise<DetectedDatabase[]>
}
