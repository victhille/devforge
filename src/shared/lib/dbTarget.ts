import type { DbConnection, DbType } from '../types/database'

export const DB_DEFAULT_PORT = { mysql: 3306, postgres: 5432, sqlite: undefined } as const satisfies Record<DbType, number | undefined>

type Target = Pick<DbConnection, 'type' | 'host' | 'port' | 'user' | 'sshConnectionId' | 'file'>

/**
 * Where a saved database password goes: the same type, host, port, user and SSH server (or the
 * same SQLite file). The label and the database name do not matter: the server receiving the
 * password stays the same. Checked by the main process before it keeps a password, and by the
 * form to say so.
 */
export function sameDbTarget(a: Target, b: Target): boolean {
  const key = (c: Target) => JSON.stringify([
    c.type, (c.host ?? '').trim().toLowerCase(), c.port ?? DB_DEFAULT_PORT[c.type] ?? null,
    (c.user ?? '').trim(), c.sshConnectionId || null, c.file ?? null
  ])
  return key(a) === key(b)
}
