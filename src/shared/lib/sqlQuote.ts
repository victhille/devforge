import type { DbTableRef, DbType } from '../types'

/** Quoted identifier, safe for any name */
export function quoteIdent(type: DbType, t: DbTableRef): string {
  if (type === 'mysql') return '`' + t.name.replace(/`/g, '``') + '`'
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"'
  return type === 'postgres' && t.schema ? `${q(t.schema)}.${q(t.name)}` : q(t.name)
}

/**
 * A text written in the SQL itself, for a query shown. MySQL reads backslashes;
 * PostgreSQL may too (standard_conforming_strings off): there a value with one
 * becomes an E'…' string, where backslashes are always read.
 */
export function sqlString(type: DbType, s: string): string {
  const quoted = s.replace(/'/g, "''")
  if (type === 'mysql') return `'${quoted.replace(/\\/g, '\\\\')}'`
  if (type === 'postgres' && s.includes('\\')) return `E'${quoted.replace(/\\/g, '\\\\')}'`
  return `'${quoted}'`
}

export function quoteColumn(type: DbType, name: string): string {
  return type === 'mysql' ? '`' + name.replace(/`/g, '``') + '`' : '"' + name.replace(/"/g, '""') + '"'
}
