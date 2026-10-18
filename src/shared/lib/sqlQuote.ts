import type { DbTableRef, DbType } from '../types'

/** Quoted identifier, safe for any name */
export function quoteIdent(type: DbType, t: DbTableRef): string {
  if (type === 'mysql') return '`' + t.name.replace(/`/g, '``') + '`'
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"'
  return type === 'postgres' && t.schema ? `${q(t.schema)}.${q(t.name)}` : q(t.name)
}

export function quoteColumn(type: DbType, name: string): string {
  return type === 'mysql' ? '`' + name.replace(/`/g, '``') + '`' : '"' + name.replace(/"/g, '""') + '"'
}
