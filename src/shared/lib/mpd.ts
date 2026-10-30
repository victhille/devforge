import type { DbDiagram, DbDiagramLink, DbDiagramTable } from '../types/database'
import type { Cardinality, McdAttribute, McdModel, McdType, MldNaming, MpdColumn, MpdIndex, MpdModel, MpdTable, MpdType, SqlEngine } from '../types/modeling'
import type { Point } from './mcd'
import { autoLayout, boxSize, bounds } from './schemaLayout'

/**
 * v3.9 lot 3: from the MCD to the database. The MLD (relations, keys) follows
 * the Merise rules; the MPD gives it SQL names and types and can be changed by
 * hand; the SQL is the MPD written for one engine.
 */

export const SQL_ENGINES: SqlEngine[] = ['postgres', 'mysql', 'sqlite']
export const MPD_TYPES: MpdType[] = ['int', 'bigint', 'smallint', 'decimal', 'float', 'varchar', 'char', 'text', 'bool', 'date', 'datetime', 'time', 'uuid', 'json']
export const DEFAULT_NAMING: MldNaming = { tables: 'snake', pk: 'id', fk: 'table_id', join: 'tables' }

const maxOne = (c: Cardinality) => c.endsWith(',1')

// ── MLD ──────────────────────────────────────────────────────────────────────

export interface MldColumn {
  /** The Merise name: the attribute's, or the identifier pointed at */
  name: string
  /** Where it comes from: an attribute id, or "leg id:identifier id" for a foreign key */
  key: string
  attr: McdAttribute
  pk: boolean
  /** A foreign key: the relation (entity id) and the identifier it points at */
  fk?: { relation: string; attr: string }
  nullable: boolean
  unique: boolean
  /** Tells two keys to the same table apart (the association, or the entity) */
  role?: string
}

export interface MldRelation {
  /** The entity's or the association's id */
  id: string
  name: string
  from: 'entity' | 'association'
  columns: MldColumn[]
}

/** Why the MLD is what it is, one line per rule applied */
export type MldRule =
  | { kind: 'entity'; relation: string; key: string[] }
  | { kind: 'noIdentifier'; relation: string; key: string }
  | { kind: 'fk'; association: string; child: string; parent: string; cards: string; columns: string[] }
  | { kind: 'oneToOne'; association: string; child: string; parent: string; cards: string; columns: string[] }
  | { kind: 'table'; association: string; relation: string; legs: number; columns: string[] }
  | { kind: 'skipped'; association: string }

export interface Mld { relations: MldRelation[]; rules: MldRule[] }

/** Words of a name, without accents: "Ligne de commande" → ["ligne", "de", "commande"] */
function words(s: string): string[] {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}
export const snake = (s: string) => words(s).join('_') || 'x'

/** A name not taken yet in this list: name, name_role, name_2… */
function free(taken: Set<string>, name: string, role?: string): string {
  let out = name
  if (taken.has(out.toLowerCase()) && role) out = `${name}_${role}`
  for (let i = 2; taken.has(out.toLowerCase()); i++) out = `${name}_${i}`
  taken.add(out.toLowerCase())
  return out
}

/** The MCD turned into relations: each entity, then each association that needs its own (Merise rules) */
export function toMld(m: McdModel): Mld {
  const rules: MldRule[] = []
  const relations = new Map<string, MldRelation>()
  const ids = new Map<string, McdAttribute[]>()
  const taken = new Map<string, Set<string>>()
  const named = (a: McdAttribute) => a.name.trim()

  for (const e of m.entities) {
    const own = e.attributes.filter(named)
    let key = own.filter(a => a.identifier)
    const columns: MldColumn[] = []
    if (!key.length) {
      // No identifier: one is added, so the relation still has its key
      const a: McdAttribute = { id: `${e.id}-id`, name: `id_${snake(e.name)}`, type: 'int', identifier: true }
      key = [a]
      columns.push({ name: a.name, key: a.id, attr: a, pk: true, nullable: false, unique: false })
      rules.push({ kind: 'noIdentifier', relation: e.name, key: a.name })
    }
    for (const a of own) columns.push({ name: a.name, key: a.id, attr: a, pk: !!a.identifier, nullable: !a.identifier, unique: false })
    ids.set(e.id, key)
    taken.set(e.id, new Set(columns.map(c => c.name.toLowerCase())))
    relations.set(e.id, { id: e.id, name: e.name, from: 'entity', columns })
    rules.push({ kind: 'entity', relation: e.name, key: key.map(a => a.name) })
  }

  const entityName = new Map(m.entities.map(e => [e.id, e.name]))
  const fkColumns = (into: string, leg: { id: string; entity: string }, role: string, pk: boolean, nullable: boolean, unique: boolean): MldColumn[] =>
    ids.get(leg.entity)!.map(a => ({
      name: free(taken.get(into)!, a.name, role), key: `${leg.id}:${a.id}`, attr: a, pk, fk: { relation: leg.entity, attr: a.id }, nullable, unique, role
    }))

  for (const a of m.associations) {
    const legs = m.links.filter(l => l.association === a.id && relations.has(l.entity))
    if (legs.length < 2) { rules.push({ kind: 'skipped', association: a.name }); continue }
    const carried = a.attributes.filter(named)
    if (legs.length === 2) {
      const [l1, l2] = legs
      // The foreign key goes to the side that has at most one partner (1,1 before 0,1 when both have)
      const child = maxOne(l1.card) && !maxOne(l2.card) ? l1
        : maxOne(l2.card) && !maxOne(l1.card) ? l2
        : maxOne(l1.card) && maxOne(l2.card) ? (l1.card === '0,1' && l2.card === '1,1' ? l2 : l1)
        : null
      if (child) {
        const parent = child === l1 ? l2 : l1
        const both = maxOne(parent.card)
        const nullable = child.card === '0,1'
        const rel = relations.get(child.entity)!
        const role = snake(a.name)
        const fks = fkColumns(child.entity, parent, role, false, nullable, both)
        rel.columns.push(...fks)
        for (const x of carried) rel.columns.push({ name: free(taken.get(child.entity)!, x.name, role), key: x.id, attr: x, pk: false, nullable: true, unique: false })
        rules.push({
          kind: both ? 'oneToOne' : 'fk', association: a.name, child: entityName.get(child.entity)!, parent: entityName.get(parent.entity)!,
          cards: `${parent.card} — ${child.card}`, columns: fks.map(c => c.name)
        })
        continue
      }
    }
    // Several on every side, or more than two legs: the association becomes a relation keyed by its foreign keys
    taken.set(a.id, new Set())
    const columns: MldColumn[] = []
    for (const leg of legs) columns.push(...fkColumns(a.id, leg, snake(entityName.get(leg.entity)!), true, false, false))
    for (const x of carried) columns.push({ name: free(taken.get(a.id)!, x.name), key: x.id, attr: x, pk: false, nullable: false, unique: false })
    relations.set(a.id, { id: a.id, name: a.name, from: 'association', columns })
    rules.push({ kind: 'table', association: a.name, relation: a.name, legs: legs.length, columns: columns.filter(c => c.fk).map(c => c.name) })
  }
  return { relations: [...relations.values()], rules }
}

/** The MCD's fingerprint for the MPD: what changes the tables, not where the boxes are */
export function mcdHash(m: McdModel, naming: MldNaming): string {
  const s = JSON.stringify({
    e: m.entities.map(x => [x.id, x.name, x.attributes]),
    a: m.associations.map(x => [x.id, x.name, x.attributes]),
    l: m.links.map(x => [x.entity, x.association, x.card]),
    naming
  })
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// ── MPD ──────────────────────────────────────────────────────────────────────

export function tableName(name: string, how: MldNaming['tables']): string {
  const w = words(name)
  if (!w.length) return 'table_x'
  if (how === 'upper') return w.join('_').toUpperCase()
  if (how === 'pascal') return w.map(x => x[0].toUpperCase() + x.slice(1)).join('')
  return w.join('_')
}

const TYPE_OF: Record<McdType, Pick<MpdColumn, 'type' | 'length' | 'scale'>> = {
  int: { type: 'int' }, decimal: { type: 'decimal', length: 10, scale: 2 }, varchar: { type: 'varchar', length: 255 }, text: { type: 'text' },
  bool: { type: 'bool' }, date: { type: 'date' }, datetime: { type: 'datetime' }, time: { type: 'time' }, uuid: { type: 'uuid' }, json: { type: 'json' }
}
function typeOf(a: McdAttribute): Pick<MpdColumn, 'type' | 'length' | 'scale'> {
  if (!a.type) return { type: 'varchar', length: 255 }
  const t = TYPE_OF[a.type]
  return a.type === 'varchar' && a.length ? { ...t, length: a.length } : t
}

/**
 * The MPD made from the MCD. Made again, it keeps what was changed by hand
 * (names, types, indexes) and where each table was put.
 */
export function generateMpd(m: McdModel, naming: MldNaming, engine: SqlEngine, prev?: MpdModel | null, source?: string): MpdModel {
  const mld = toMld(m)
  const oldTables = new Map((prev?.tables ?? []).map(t => [t.id, t]))
  const tid = (rel: string) => `t-${rel}`
  const cid = (key: string) => `c-${key}`
  const entityTable = new Map(mld.relations.filter(r => r.from === 'entity').map(r => [r.id, tableName(r.name, naming.tables)]))
  const takenTables = new Set<string>()

  // Each relation's primary key names first: foreign keys are named after them
  const pkName = new Map<string, string>()
  for (const r of mld.relations) {
    const pk = r.columns.filter(c => c.pk && !c.fk)
    for (const c of pk) pkName.set(`${r.id}:${c.attr.id}`, naming.pk === 'id' && pk.length === 1 ? 'id' : snake(c.name))
  }

  const tables: MpdTable[] = mld.relations.map(r => {
    const id = tid(r.id)
    const old = oldTables.get(id)
    let name = r.from === 'entity' || naming.join === 'association'
      ? tableName(r.name, naming.tables)
      : tableName([...new Set(r.columns.filter(c => c.fk).map(c => entityTable.get(c.fk!.relation)!))].join(' '), naming.tables)
    name = free(takenTables, name)
    const takenCols = new Set<string>()
    const ownPk = r.columns.filter(c => c.pk && !c.fk).length
    const columns: MpdColumn[] = r.columns.map(c => {
      let colName: string
      if (c.fk) {
        const parentPk = ids(mld, c.fk.relation)
        const parent = snake(entityTable.get(c.fk.relation)!)
        const target = pkName.get(`${c.fk.relation}:${c.fk.attr}`)!
        colName = parentPk === 1
          ? (naming.fk === 'table_id' ? `${parent}_id` : `id_${parent}`)
          : `${parent}_${target}`
      } else colName = c.pk ? pkName.get(`${r.id}:${c.attr.id}`)! : snake(c.name)
      const col: MpdColumn = {
        // Same table twice (a reflexive association): the role tells them apart
        id: cid(c.key), name: free(takenCols, colName, c.role), ...typeOf(c.attr), from: c.key,
        ...(c.pk ? { pk: true } : {}),
        ...(c.nullable ? { nullable: true } : {}),
        ...(c.unique ? { unique: true } : {}),
        ...(c.pk && !c.fk && ownPk === 1 && c.attr.type === 'int' ? { auto: true } : {}),
        ...(c.fk ? { ref: { table: tid(c.fk.relation), column: cid(c.fk.attr) } } : {})
      }
      const was = old?.columns.find(x => x.id === col.id)
      return was?.edited ? { ...col, name: was.name, type: was.type, length: was.length, scale: was.scale, nullable: was.nullable, unique: was.unique, edited: true } : col
    })
    const colIds = new Set(columns.map(c => c.id))
    const indexes: MpdIndex[] = (old?.indexes ?? []).filter(i => i.columns.every(c => colIds.has(c)))
    return { id, name: old?.edited ? old.name : name, x: old?.x ?? 0, y: old?.y ?? 0, columns, indexes, from: r.id, ...(old?.edited ? { edited: true } : {}) }
  })
  return placeNew(syncForeignKeys({ engine, naming, tables, ...(source ? { source } : {}), sourceHash: mcdHash(m, naming) }), new Set(oldTables.keys()))
}

/** Tables without a place laid out like the database schema: all of them the first time, else to the right of the others */
export function placeNew(mpd: MpdModel, placed: Set<string>): MpdModel {
  const fresh = mpd.tables.filter(t => !placed.has(t.id))
  if (!fresh.length) return mpd
  const { diagram } = mpdDiagram({ ...mpd, tables: fresh })
  const pos = autoLayout(diagram.tables, diagram.links)
  const others = mpdDiagram({ ...mpd, tables: mpd.tables.filter(t => placed.has(t.id)) }).diagram.tables
  const there = others.length ? bounds(mpd.tables.filter(t => placed.has(t.id)).map((t, i) => ({ x: t.x, y: t.y, ...boxSize(others[i]) }))) : null
  return {
    ...mpd,
    tables: mpd.tables.map(t => {
      const p = pos[`${t.id}.${t.name}`]
      if (placed.has(t.id) || !p) return t
      return there ? { ...t, x: p.x + there.x + there.w + 160, y: p.y + there.y } : { ...t, x: p.x, y: p.y }
    })
  }
}

/** How many columns make a relation's own key */
function ids(mld: Mld, relation: string): number {
  return mld.relations.find(r => r.id === relation)?.columns.filter(c => c.pk && !c.fk).length ?? 1
}

/** Foreign keys take the type of the column they point at (unless changed by hand) */
export function syncForeignKeys(mpd: MpdModel): MpdModel {
  const cols = new Map(mpd.tables.flatMap(t => t.columns.map(c => [`${t.id}:${c.id}`, c] as const)))
  return {
    ...mpd,
    tables: mpd.tables.map(t => ({
      ...t,
      columns: t.columns.map(c => {
        const target = c.ref && cols.get(`${c.ref.table}:${c.ref.column}`)
        if (!target || c.edited) return c
        const { auto: _, ...rest } = c
        return { ...rest, type: target.type, length: target.length, scale: target.scale }
      })
    }))
  }
}

// ── SQL ──────────────────────────────────────────────────────────────────────

/** A column's type for one engine */
export function sqlType(c: Pick<MpdColumn, 'type' | 'length' | 'scale'>, engine: SqlEngine): string {
  const n = c.length, s = c.scale ?? 0
  if (engine === 'sqlite') {
    const lite: Partial<Record<MpdType, string>> = { int: 'INTEGER', bigint: 'INTEGER', smallint: 'INTEGER', bool: 'INTEGER', decimal: 'NUMERIC', float: 'REAL' }
    return lite[c.type] ?? 'TEXT'
  }
  const pg = engine === 'postgres'
  switch (c.type) {
    case 'int': return pg ? 'INTEGER' : 'INT'
    case 'bigint': return 'BIGINT'
    case 'smallint': return 'SMALLINT'
    case 'decimal': return `${pg ? 'NUMERIC' : 'DECIMAL'}(${n ?? 10},${s})`
    case 'float': return pg ? 'DOUBLE PRECISION' : 'DOUBLE'
    case 'varchar': return `VARCHAR(${n ?? 255})`
    case 'char': return `CHAR(${n ?? 1})`
    case 'text': return 'TEXT'
    case 'bool': return pg ? 'BOOLEAN' : 'TINYINT(1)'
    case 'date': return 'DATE'
    case 'datetime': return pg ? 'TIMESTAMP' : 'DATETIME'
    case 'time': return 'TIME'
    case 'uuid': return pg ? 'UUID' : 'CHAR(36)'
    case 'json': return pg ? 'JSONB' : 'JSON'
  }
}

/** Words the engines keep for themselves: such a name is quoted */
const RESERVED = new Set(('add all alter and as asc between by case check column constraint create cross current_date current_time current_user ' +
  'default delete desc distinct drop else end exists false fetch for foreign from full grant group having in index inner insert interval into is ' +
  'join key left like limit natural not null offset on or order outer primary references right row rows select session_user set table then to ' +
  'true union unique update user using values when where window with').split(' '))

export function quoteName(name: string, engine: SqlEngine): string {
  if (/^[a-z_][a-z0-9_]*$/i.test(name) && !RESERVED.has(name.toLowerCase())) return name
  return engine === 'mysql' ? `\`${name.replace(/`/g, '``')}\`` : `"${name.replace(/"/g, '""')}"`
}

interface ForeignKey { table: MpdTable; columns: MpdColumn[]; to: MpdTable; refColumns: MpdColumn[] }

/** A table's foreign keys, the columns of one key together (a key of several columns) */
export function foreignKeys(mpd: MpdModel, t: MpdTable): ForeignKey[] {
  const byId = new Map(mpd.tables.map(x => [x.id, x]))
  const groups = new Map<string, MpdColumn[]>()
  for (const c of t.columns) {
    if (!c.ref || !byId.has(c.ref.table)) continue
    const leg = c.from?.includes(':') ? c.from.split(':')[0] : c.id
    const k = `${c.ref.table}|${leg}`
    groups.set(k, [...(groups.get(k) ?? []), c])
  }
  const out: ForeignKey[] = []
  for (const cols of groups.values()) {
    const to = byId.get(cols[0].ref!.table)!
    const refColumns = cols.map(c => to.columns.find(x => x.id === c.ref!.column)).filter((x): x is MpdColumn => !!x)
    if (refColumns.length === cols.length) out.push({ table: t, columns: cols, to, refColumns })
  }
  return out
}

/**
 * The CREATE TABLE script: tables pointed at first; a cycle of foreign keys
 * ends with ALTER TABLE (SQLite takes them in any order).
 */
export function mpdSql(mpd: MpdModel, header: string[] = []): string {
  const e = mpd.engine
  const q = (s: string) => quoteName(s, e)
  const fks = new Map(mpd.tables.map(t => [t.id, foreignKeys(mpd, t)]))

  // Tables in an order where each comes after those it points at, when it can
  const done = new Set<string>()
  const order: MpdTable[] = []
  let left = [...mpd.tables]
  while (left.length) {
    const ready = left.filter(t => fks.get(t.id)!.every(f => f.to.id === t.id || done.has(f.to.id)))
    const next = ready.length ? ready : [left[0]]
    for (const t of next) { order.push(t); done.add(t.id) }
    left = left.filter(t => !done.has(t.id))
  }

  const created = new Set<string>()
  const later: string[] = []
  const out: string[] = header.map(h => `-- ${h}`)
  if (out.length) out.push('')
  for (const t of order) {
    const pk = t.columns.filter(c => c.pk)
    const lone = pk.length === 1 ? pk[0] : null
    const lines = t.columns.map(c => {
      let line = `  ${q(c.name)} `
      if (c === lone && c.auto && ['int', 'bigint', 'smallint'].includes(c.type)) {
        line += e === 'sqlite' ? 'INTEGER PRIMARY KEY AUTOINCREMENT'
          : e === 'mysql' ? `${sqlType(c, e)} AUTO_INCREMENT PRIMARY KEY`
          : `${sqlType(c, e)} GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY`
        return line
      }
      line += sqlType(c, e)
      if (!c.nullable || c.pk) line += ' NOT NULL'
      if (c === lone) line += ' PRIMARY KEY'
      else if (c.unique) line += ' UNIQUE'
      return line
    })
    if (pk.length > 1) lines.push(`  PRIMARY KEY (${pk.map(c => q(c.name)).join(', ')})`)
    for (const f of fks.get(t.id)!) {
      const ref = `FOREIGN KEY (${f.columns.map(c => q(c.name)).join(', ')}) REFERENCES ${q(f.to.name)} (${f.refColumns.map(c => q(c.name)).join(', ')})`
      if (e === 'sqlite' || f.to.id === t.id || created.has(f.to.id)) lines.push(`  ${ref}`)
      else later.push(`ALTER TABLE ${q(t.name)} ADD ${ref};`)
    }
    out.push(`CREATE TABLE ${q(t.name)} (`, lines.join(',\n'), ');')
    created.add(t.id)
    for (const i of t.indexes) {
      const cols = i.columns.map(id => t.columns.find(c => c.id === id)).filter((c): c is MpdColumn => !!c)
      if (cols.length) out.push(`CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX ${q(i.name)} ON ${q(t.name)} (${cols.map(c => q(c.name)).join(', ')});`)
    }
    out.push('')
  }
  if (later.length) out.push(...later, '')
  return out.join('\n').replace(/\n+$/, '\n')
}

// ── Check ────────────────────────────────────────────────────────────────────

export type MpdIssueCode = 'noPk' | 'noName' | 'sameTable' | 'sameColumn' | 'fkType' | 'uniqueText'
export interface MpdIssue { level: 'error' | 'warning'; code: MpdIssueCode; table: string; name: string }

export function checkMpd(mpd: MpdModel): MpdIssue[] {
  const out: MpdIssue[] = []
  const cols = new Map(mpd.tables.flatMap(t => t.columns.map(c => [`${t.id}:${c.id}`, c] as const)))
  const seen = new Set<string>()
  for (const t of mpd.tables) {
    if (!t.name.trim()) out.push({ level: 'error', code: 'noName', table: t.id, name: '' })
    else if (seen.has(t.name.toLowerCase())) out.push({ level: 'error', code: 'sameTable', table: t.id, name: t.name })
    seen.add(t.name.toLowerCase())
    if (!t.columns.some(c => c.pk)) out.push({ level: 'warning', code: 'noPk', table: t.id, name: t.name })
    const names = new Set<string>()
    for (const c of t.columns) {
      if (!c.name.trim()) out.push({ level: 'error', code: 'noName', table: t.id, name: t.name })
      else if (names.has(c.name.toLowerCase())) out.push({ level: 'error', code: 'sameColumn', table: t.id, name: `${t.name}.${c.name}` })
      names.add(c.name.toLowerCase())
      const target = c.ref && cols.get(`${c.ref.table}:${c.ref.column}`)
      if (target && sqlType(target, mpd.engine) !== sqlType(c, mpd.engine)) out.push({ level: 'error', code: 'fkType', table: t.id, name: `${t.name}.${c.name}` })
      if (mpd.engine === 'mysql' && (c.unique || c.pk) && (c.type === 'text' || c.type === 'json')) out.push({ level: 'error', code: 'uniqueText', table: t.id, name: `${t.name}.${c.name}` })
    }
  }
  return out
}

// ── The file, the drawing ────────────────────────────────────────────────────

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const pick = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? v as T : fallback)

export function cleanNaming(v: unknown): MldNaming {
  const n = (v ?? {}) as Record<string, unknown>
  return {
    tables: pick(n.tables, ['snake', 'upper', 'pascal'] as const, DEFAULT_NAMING.tables),
    pk: pick(n.pk, ['id', 'keep'] as const, DEFAULT_NAMING.pk),
    fk: pick(n.fk, ['table_id', 'id_table'] as const, DEFAULT_NAMING.fk),
    join: pick(n.join, ['tables', 'association'] as const, DEFAULT_NAMING.join)
  }
}

/** An MPD read from disk (or sent by the page), in its expected shape */
export function cleanMpd(v: unknown): MpdModel {
  const m = (v ?? {}) as Record<string, unknown>
  const size = (x: unknown, max: number) => (typeof x === 'number' && x > 0 ? { v: Math.min(max, Math.round(x)) } : null)
  const tables: MpdTable[] = arr(m.tables).map(x => {
    const t = (x ?? {}) as Record<string, unknown>
    const columns: MpdColumn[] = arr(t.columns).map(y => {
      const c = (y ?? {}) as Record<string, unknown>
      const r = (c.ref ?? null) as Record<string, unknown> | null
      const length = size(c.length, 65535), scale = typeof c.scale === 'number' && c.scale >= 0 ? Math.min(30, Math.round(c.scale)) : null
      return {
        id: str(c.id, 90) || `c-${Math.random().toString(36).slice(2, 9)}`, name: str(c.name, 64), type: pick(c.type, MPD_TYPES, 'varchar'),
        ...(length ? { length: length.v } : {}), ...(scale !== null ? { scale } : {}),
        ...(c.pk ? { pk: true } : {}), ...(c.auto ? { auto: true } : {}), ...(c.nullable ? { nullable: true } : {}), ...(c.unique ? { unique: true } : {}),
        ...(r && str(r.table, 90) && str(r.column, 90) ? { ref: { table: str(r.table, 90), column: str(r.column, 90) } } : {}),
        ...(str(c.from, 90) ? { from: str(c.from, 90) } : {}), ...(c.edited ? { edited: true } : {})
      }
    })
    const colIds = new Set(columns.map(c => c.id))
    const indexes: MpdIndex[] = arr(t.indexes).map(y => {
      const i = (y ?? {}) as Record<string, unknown>
      return { id: str(i.id, 40) || `i-${Math.random().toString(36).slice(2, 9)}`, name: str(i.name, 64), columns: arr(i.columns).map(c => str(c, 90)).filter(c => colIds.has(c)), ...(i.unique ? { unique: true } : {}) }
    }).filter(i => i.columns.length)
    return {
      id: str(t.id, 90) || `t-${Math.random().toString(36).slice(2, 9)}`, name: str(t.name, 64), x: num(t.x), y: num(t.y), columns, indexes,
      ...(str(t.from, 40) ? { from: str(t.from, 40) } : {}), ...(t.edited ? { edited: true } : {})
    }
  })
  return {
    engine: pick(m.engine, SQL_ENGINES, 'postgres'), naming: cleanNaming(m.naming), tables,
    ...(str(m.source, 80) ? { source: str(m.source, 80) } : {}), ...(str(m.sourceHash, 20) ? { sourceHash: str(m.sourceHash, 20) } : {})
  }
}

/** The MPD as the database schema draws it: the same cards, the same links */
export function mpdDiagram(mpd: MpdModel): { diagram: DbDiagram; positions: Record<string, Point> } {
  const ref = (t: MpdTable) => ({ schema: t.id, name: t.name })
  const tables: DbDiagramTable[] = mpd.tables.map(t => ({
    ...ref(t), type: 'table', columns: t.columns.map(c => ({ name: c.name, type: sqlType(c, mpd.engine), nullable: !!c.nullable && !c.pk, pk: !!c.pk }))
  }))
  const links: DbDiagramLink[] = mpd.tables.flatMap(t => foreignKeys(mpd, t).map(f => ({
    from: ref(t), columns: f.columns.map(c => c.name), to: ref(f.to), refColumns: f.refColumns.map(c => c.name)
  })))
  return { diagram: { tables, links }, positions: Object.fromEntries(mpd.tables.map(t => [`${t.id}.${t.name}`, { x: t.x, y: t.y }])) }
}
