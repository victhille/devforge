import type { MpdColumn, MpdModel, MpdTable, MpdType, SqlEngine } from '../types/modeling'
import { DEFAULT_NAMING, MPD_TYPES, placeNew } from './mpd'
import { McdSpecError as SpecError } from './mcdSpec'

/**
 * v4.2 lot 3: an MPD from a description (what Forgy writes from the user's
 * words): tables, their columns and keys, a foreign key named by the table it
 * points at. Checked, a key `id` added where none is given, then laid out.
 */

export interface MpdSpecColumn {
  name: string; type?: string; length?: number; scale?: number
  pk?: boolean; nullable?: boolean; unique?: boolean
  /** A foreign key: "table" (its key) or "table.column" */
  references?: string
}
export interface MpdSpec { tables: { name: string; columns?: MpdSpecColumn[] }[] }

const MAX = { tables: 80, columns: 60 }
const TYPES = new Set<string>(MPD_TYPES)
/** Words the model may use for a type */
const ALIASES: Record<string, MpdType> = {
  integer: 'int', number: 'int', serial: 'int', bigserial: 'bigint', double: 'float', real: 'float', numeric: 'decimal', money: 'decimal',
  string: 'varchar', boolean: 'bool', timestamp: 'datetime', 'date-time': 'datetime', timestamptz: 'datetime', jsonb: 'json'
}

const clean = (v: unknown, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** A type in the MPD's terms, with the sizes it needs */
function typed(c: MpdSpecColumn, owner: string): Pick<MpdColumn, 'type' | 'length' | 'scale'> {
  const raw = clean(c.type).toLowerCase()
  const type = TYPES.has(raw) ? raw as MpdType : ALIASES[raw]
  if (!type) throw new SpecError(`Unknown type "${c.type}" for ${owner}: use ${MPD_TYPES.join(', ')}`)
  const int = (v: unknown, fallback: number, max: number) => Math.min(Math.max(Number.isInteger(v) ? v as number : fallback, 1), max)
  if (type === 'varchar') return { type, length: int(c.length, 255, 65535) }
  if (type === 'char') return { type, length: int(c.length, 1, 255) }
  if (type === 'decimal') return { type, length: int(c.length, 10, 65), scale: Math.min(Math.max(Number.isInteger(c.scale) ? c.scale! : 2, 0), 30) }
  return { type }
}

export function mpdFromSpec(spec: unknown, engine: SqlEngine): MpdModel {
  const s = spec as MpdSpec
  if (!s || !Array.isArray(s.tables) || !s.tables.length) throw new SpecError('Give at least one table in "tables"')
  if (s.tables.length > MAX.tables) throw new SpecError(`At most ${MAX.tables} tables`)
  let n = 0
  const next = (p: string) => `${p}${(++n).toString(36)}`
  const byName = new Map<string, MpdTable>()
  /** The foreign keys, filled in once every table is known */
  const pending: { table: string; column: MpdColumn; spec: MpdSpecColumn }[] = []

  const tables: MpdTable[] = s.tables.map(t => {
    const name = clean(t?.name)
    if (!name) throw new SpecError('A table has no name')
    if (byName.has(name.toLowerCase())) throw new SpecError(`Two tables are named ${name}: each name must be unique`)
    const list = t.columns ?? []
    if (!Array.isArray(list)) throw new SpecError(`"columns" of ${name} must be a list`)
    if (list.length > MAX.columns) throw new SpecError(`${name} has more than ${MAX.columns} columns`)
    const seen = new Set<string>()
    const columns: MpdColumn[] = list.map(c => {
      const col = clean(c?.name)
      if (!col) throw new SpecError(`A column of ${name} has no name`)
      if (seen.has(col.toLowerCase())) throw new SpecError(`${name} has two columns named ${col}`)
      seen.add(col.toLowerCase())
      const out: MpdColumn = {
        id: next('c'), name: col,
        // A foreign key without a type takes the one of the key it points at (below)
        ...(c.type || !c.references ? typed(c, `${name}.${col}`) : { type: 'int' as MpdType }),
        ...(c.pk === true ? { pk: true } : c.nullable === false ? {} : { nullable: true }),
        ...(c.unique === true && !c.pk ? { unique: true } : {})
      }
      if (c.references) pending.push({ table: name, column: out, spec: c })
      return out
    })
    // Every table has a key
    if (!columns.some(c => c.pk)) columns.unshift({ id: next('c'), name: seen.has('id') ? `id_${name.toLowerCase()}` : 'id', type: 'int', pk: true })
    const pks = columns.filter(c => c.pk)
    if (pks.length === 1 && pks[0].type === 'int' && !pending.some(p => p.column === pks[0])) pks[0].auto = true
    const table: MpdTable = { id: next('t'), name, x: 0, y: 0, columns, indexes: [] }
    byName.set(name.toLowerCase(), table)
    return table
  })

  for (const { table, column, spec } of pending) {
    const [to, col] = String(spec.references).trim().split('.')
    const target = byName.get(to.trim().toLowerCase())
    if (!target) throw new SpecError(`${table}.${column.name} references an unknown table "${to}" (declare it in "tables")`)
    const pks = target.columns.filter(c => c.pk)
    const ref = col ? target.columns.find(c => c.name.toLowerCase() === col.trim().toLowerCase()) : pks.length === 1 ? pks[0] : undefined
    if (!ref) throw new SpecError(col ? `${table}.${column.name}: ${target.name} has no column "${col}"` : `${table}.${column.name}: give "${target.name}.column" (its key has several columns)`)
    if (!spec.type) Object.assign(column, { type: ref.type, length: ref.length, scale: ref.scale })
    column.ref = { table: target.id, column: ref.id }
  }

  return placeNew({ engine, naming: DEFAULT_NAMING, tables }, new Set())
}
