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
  /** Look for databases on a server (Docker containers + native services) */
  detectRemote: (sshConnectionId: string) => Promise<DetectedDatabase[]>
  /** Save a detected database as a connection, returns its id */
  addDetected: (key: string) => Promise<string>
  /** Databases described in the .env files of saved projects */
  detectLocal: () => Promise<DetectedDatabase[]>
}
