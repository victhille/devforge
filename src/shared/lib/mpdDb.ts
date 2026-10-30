import type { DbDiagram, DbDiagramLink, DbDiagramTable } from '../types/database'
import type { Cardinality, McdAttribute, McdModel, McdType, MldNaming, MpdColumn, MpdDiff, MpdModel, MpdTable, ScriptLine, SqlEngine } from '../types/modeling'
import { autoLayout } from './schemaLayout'
import { columnSql, foreignKeys, foreignKeySql, generateMpd, mpdStatements, placeNew, quoteName, snake, sqlType } from './mpd'

/**
 * v3.9 lot 4: the MPD and a real database. What differs, the script that
 * catches up, the database taken into the MPD, and an MCD read back from a
 * database (link tables become associations, foreign keys 1,1 — 0,n legs).
 */

const lc = (s: string) => s.toLowerCase()

/** A type as a database reports it, in the MPD's terms; null when the MPD has no such type */
export function parseSqlType(raw: string): Pick<MpdColumn, 'type' | 'length' | 'scale'> | null {
  const s = raw.trim().toLowerCase()
  const m = s.match(/\((\d+)(?:\s*,\s*(\d+))?\)/)
  const n = m ? Number(m[1]) : undefined
  const scale = m?.[2] !== undefined ? Number(m[2]) : undefined
  const base = s.replace(/\(.*?\)/g, '').replace(/\b(unsigned|zerofill|signed)\b/g, '').replace(/\s+/g, ' ').trim()
  if ((base === 'tinyint' && n === 1) || base === 'boolean' || base === 'bool') return { type: 'bool' }
  if (/^(integer|int|int4|mediumint|serial)$/.test(base)) return { type: 'int' }
  if (/^(bigint|int8|bigserial)$/.test(base)) return { type: 'bigint' }
  if (/^(smallint|int2|tinyint|smallserial)$/.test(base)) return { type: 'smallint' }
  if (/^(numeric|decimal)$/.test(base)) return { type: 'decimal', length: n ?? 10, scale: scale ?? 0 }
  if (/^(double precision|double|real|float|float4|float8)$/.test(base)) return { type: 'float' }
  if (/^(character varying|varchar|nvarchar)$/.test(base)) return { type: 'varchar', length: n ?? 255 }
  if (/^(character|char|nchar|bpchar)$/.test(base)) return { type: 'char', length: n ?? 1 }
  if (/^(text|tinytext|mediumtext|longtext|clob)$/.test(base)) return { type: 'text' }
  if (base === 'date') return { type: 'date' }
  if (/^(timestamp|datetime)/.test(base)) return { type: 'datetime' }
  if (/^time\b/.test(base)) return { type: 'time' }
  if (base === 'uuid') return { type: 'uuid' }
  if (base === 'json' || base === 'jsonb') return { type: 'json' }
  return null
}

/** The MPD's column and the database's have the same type, as this engine writes it */
export function sameType(c: Pick<MpdColumn, 'type' | 'length' | 'scale'>, raw: string, engine: SqlEngine): boolean {
  const p = parseSqlType(raw)
  return p ? sqlType(c, engine) === sqlType(p, engine) : lc(sqlType(c, engine)) === lc(raw.trim())
}

/** The database's tables (no views); PostgreSQL: the public schema when it has some */
export function dbTablesOf(db: DbDiagram): DbDiagramTable[] {
  const tables = db.tables.filter(t => t.type === 'table')
  const pub = tables.filter(t => t.schema === 'public')
  return pub.length ? pub : tables
}

const linksFrom = (db: DbDiagram, t: DbDiagramTable) => db.links.filter(l => l.from.schema === t.schema && l.from.name === t.name)
const fkSig = (cols: string[], to: string, refs: string[]) => lc(`(${cols.join(',')})>${to}(${refs.join(',')})`)

// ── Differences ──────────────────────────────────────────────────────────────

export function diffMpd(mpd: MpdModel, db: DbDiagram): MpdDiff[] {
  const e = mpd.engine
  const tables = dbTablesOf(db)
  const byName = new Map(tables.map(t => [lc(t.name), t]))
  const out: MpdDiff[] = []
  for (const t of mpd.tables) {
    const d = byName.get(lc(t.name))
    if (!d) { out.push({ kind: 'tableMissing', table: t.name }); continue }
    const cols = new Map(d.columns.map(c => [lc(c.name), c]))
    for (const c of t.columns) {
      const dc = cols.get(lc(c.name))
      if (!dc) { out.push({ kind: 'columnMissing', table: t.name, column: c.name, mpd: sqlType(c, e) }); continue }
      if (!sameType(c, dc.type, e)) out.push({ kind: 'type', table: t.name, column: c.name, mpd: sqlType(c, e), db: dc.type.toUpperCase() })
      const nullable = !!c.nullable && !c.pk
      if (nullable !== dc.nullable && !c.pk) out.push({ kind: 'nullable', table: t.name, column: c.name, mpd: nullable ? 'NULL' : 'NOT NULL', db: dc.nullable ? 'NULL' : 'NOT NULL' })
    }
    const names = new Set(t.columns.map(c => lc(c.name)))
    for (const dc of d.columns) if (!names.has(lc(dc.name))) out.push({ kind: 'columnExtra', table: t.name, column: dc.name, db: dc.type.toUpperCase(), danger: true })
    const pk = t.columns.filter(c => c.pk).map(c => c.name)
    const dbPk = d.columns.filter(c => c.pk).map(c => c.name)
    if (lc([...pk].sort().join(',')) !== lc([...dbPk].sort().join(','))) out.push({ kind: 'pk', table: t.name, mpd: pk.join(', '), db: dbPk.join(', ') })
    const mine = foreignKeys(mpd, t).map(f => ({ sig: fkSig(f.columns.map(c => c.name), f.to.name, f.refColumns.map(c => c.name)), text: `(${f.columns.map(c => c.name).join(', ')}) → ${f.to.name}` }))
    const theirs = linksFrom(db, d).map(l => ({ sig: fkSig(l.columns, l.to.name, l.refColumns), text: `(${l.columns.join(', ')}) → ${l.to.name}` }))
    for (const f of mine) if (!theirs.some(x => x.sig === f.sig)) out.push({ kind: 'fkMissing', table: t.name, mpd: f.text })
    for (const f of theirs) if (!mine.some(x => x.sig === f.sig)) out.push({ kind: 'fkExtra', table: t.name, db: f.text })
  }
  const mineNames = new Set(mpd.tables.map(t => lc(t.name)))
  for (const d of tables) if (!mineNames.has(lc(d.name))) out.push({ kind: 'tableExtra', table: d.name, danger: true })
  return out
}

/** Notes written in the script for what it cannot do itself */
export interface ScriptNotes {
  pk: string
  fkExtra: string
  sqliteType: string
  sqliteFk: string
}

/** The script that brings the database to the MPD: creations first, what loses data last */
export function diffScript(mpd: MpdModel, diffs: MpdDiff[], notes: ScriptNotes): ScriptLine[] {
  const e = mpd.engine
  const q = (s: string) => quoteName(s, e)
  const byName = new Map(mpd.tables.map(t => [lc(t.name), t]))
  const col = (d: MpdDiff) => byName.get(lc(d.table))?.columns.find(c => lc(c.name) === lc(d.column ?? ''))
  const fill = (tpl: string, d: MpdDiff) => tpl.replace('{table}', d.table).replace('{column}', d.column ?? '').replace('{mpd}', d.mpd ?? '').replace('{db}', d.db ?? '')
  const lines: ScriptLine[] = []
  const at = (kind: MpdDiff['kind']) => diffs.filter(d => d.kind === kind)

  const missing = new Set(at('tableMissing').map(d => byName.get(lc(d.table))!.id))
  if (missing.size) {
    const { tables, later } = mpdStatements(mpd, missing)
    lines.push(...tables.flat().map(sql => ({ sql })), ...later.map(sql => ({ sql })))
  }
  for (const d of at('columnMissing')) {
    const c = col(d)!
    lines.push({ sql: `ALTER TABLE ${q(d.table)} ADD COLUMN ${columnSql(e === 'sqlite' ? { ...c, nullable: true } : c, e, false)};` })
  }
  // A column whose type or emptiness changes: one MODIFY for MySQL, one ALTER each for PostgreSQL
  const changed = [...new Set([...at('type'), ...at('nullable')].map(d => `${d.table}\n${d.column}`))]
  for (const key of changed) {
    const [table, column] = key.split('\n')
    const d = { kind: 'type', table, column } as MpdDiff
    const c = col(d)!
    const typeDiff = at('type').find(x => x.table === table && x.column === column)
    if (e === 'sqlite') { if (typeDiff) lines.push({ sql: `-- ${fill(notes.sqliteType, typeDiff)}`, comment: true }); continue }
    if (e === 'mysql') {
      const lone = c.pk && byName.get(lc(table))!.columns.filter(x => x.pk).length === 1
      lines.push({ sql: `ALTER TABLE ${q(table)} MODIFY COLUMN ${q(c.name)} ${sqlType(c, e)}${!c.nullable || c.pk ? ' NOT NULL' : ''}${lone && c.auto ? ' AUTO_INCREMENT' : ''};` })
      continue
    }
    if (typeDiff) lines.push({ sql: `ALTER TABLE ${q(table)} ALTER COLUMN ${q(c.name)} TYPE ${sqlType(c, e)} USING ${q(c.name)}::${sqlType(c, e)};` })
    if (at('nullable').some(x => x.table === table && x.column === column)) {
      lines.push({ sql: `ALTER TABLE ${q(table)} ALTER COLUMN ${q(c.name)} ${c.nullable ? 'DROP' : 'SET'} NOT NULL;` })
    }
  }
  for (const d of at('fkMissing')) {
    const t = byName.get(lc(d.table))!
    if (missing.has(t.id)) continue
    for (const f of foreignKeys(mpd, t)) {
      if (`(${f.columns.map(c => c.name).join(', ')}) → ${f.to.name}` !== d.mpd) continue
      lines.push(e === 'sqlite' ? { sql: `-- ${fill(notes.sqliteFk, d)}`, comment: true } : { sql: `ALTER TABLE ${q(t.name)} ADD ${foreignKeySql(f, e)};` })
    }
  }
  for (const d of at('pk')) lines.push({ sql: `-- ${fill(notes.pk, d)}`, comment: true })
  for (const d of at('fkExtra')) lines.push({ sql: `-- ${fill(notes.fkExtra, d)}`, comment: true })
  for (const d of at('columnExtra')) lines.push({ sql: `ALTER TABLE ${q(d.table)} DROP COLUMN ${q(d.column!)};`, danger: true })
  for (const d of at('tableExtra')) lines.push({ sql: `DROP TABLE ${q(d.table)};`, danger: true })
  return lines
}

// ── The database into the MPD ────────────────────────────────────────────────

/**
 * The MPD made like the database: its tables, columns, types and keys. What
 * matches by name keeps its id (so its tie to the MCD) and its place; what the
 * database changed is marked as changed by hand, so an update from the MCD keeps it.
 */
export function adoptDb(mpd: MpdModel, db: DbDiagram): MpdModel {
  const e = mpd.engine
  const dbt = dbTablesOf(db)
  const old = new Map(mpd.tables.map(t => [lc(t.name), t]))
  const placed = new Set<string>()
  const ids = new Map<string, { id: string; cols: Map<string, string> }>()
  const tables: MpdTable[] = dbt.map(d => {
    const was = old.get(lc(d.name))
    const id = was?.id ?? `t-db-${snake(d.name)}`
    if (was) placed.add(id)
    const oldCols = new Map((was?.columns ?? []).map(c => [lc(c.name), c]))
    const lonePk = d.columns.filter(c => c.pk).length === 1
    const cols = new Map<string, string>()
    const columns: MpdColumn[] = d.columns.map(dc => {
      const w = oldCols.get(lc(dc.name))
      const typed = parseSqlType(dc.type) ?? { type: 'text' as const }
      const nullable = dc.nullable && !dc.pk
      const typeChanged = !w || !sameType(w, dc.type, e)
      const changed = !w || typeChanged || !!w.pk !== dc.pk || (!!w.nullable && !w.pk) !== nullable || w.name !== dc.name
      const { ref: _r, ...rest } = w ?? { id: `c-db-${snake(d.name)}-${snake(dc.name)}`, name: dc.name, type: typed.type }
      const c: MpdColumn = {
        ...rest, name: dc.name, ...(typeChanged ? { type: typed.type, length: typed.length, scale: typed.scale } : {}),
        pk: dc.pk || undefined, nullable: nullable || undefined,
        auto: dc.pk && lonePk && ['int', 'bigint', 'smallint'].includes(typeChanged ? typed.type : w!.type) ? (w ? w.auto : true) : undefined,
        ...(changed || w?.edited ? { edited: true } : {})
      }
      cols.set(lc(dc.name), c.id)
      return c
    })
    ids.set(`${d.schema}.${d.name}`, { id, cols })
    const colIds = new Set(columns.map(c => c.id))
    return {
      id, name: d.name, x: was?.x ?? 0, y: was?.y ?? 0, columns, indexes: (was?.indexes ?? []).filter(i => i.columns.every(c => colIds.has(c))),
      ...(was?.from ? { from: was.from } : {}), ...(was && (was.edited || was.name !== d.name) ? { edited: true } : {})
    }
  })
  // The database's foreign keys become the MPD's
  const byId = new Map(tables.map(t => [t.id, t]))
  for (const l of db.links) {
    const from = ids.get(`${l.from.schema}.${l.from.name}`), to = ids.get(`${l.to.schema}.${l.to.name}`)
    if (!from || !to) continue
    l.columns.forEach((name, i) => {
      const c = byId.get(from.id)!.columns.find(x => x.id === from.cols.get(lc(name)))
      const target = to.cols.get(lc(l.refColumns[i] ?? ''))
      if (c && target) c.ref = { table: to.id, column: target }
    })
  }
  return placeNew({ ...mpd, tables }, placed)
}

// ── A database read back as an MCD ───────────────────────────────────────────

function mcdType(t: Pick<MpdColumn, 'type' | 'length'>): Pick<McdAttribute, 'type' | 'length'> {
  const map: Record<MpdColumn['type'], McdType> = {
    int: 'int', bigint: 'int', smallint: 'int', decimal: 'decimal', float: 'decimal', varchar: 'varchar', char: 'varchar',
    text: 'text', bool: 'bool', date: 'date', datetime: 'datetime', time: 'time', uuid: 'uuid', json: 'json'
  }
  const type = map[t.type]
  return type === 'varchar' && t.length ? { type, length: t.length } : { type }
}

/** How the database names things, guessed so the MPD made from the MCD looks like it */
export function guessNaming(db: DbDiagram): MldNaming {
  const tables = dbTablesOf(db)
  const names = tables.map(t => t.name)
  const pks = tables.map(t => t.columns.filter(c => c.pk)).filter(p => p.length === 1).map(p => p[0].name)
  const fkCols = db.links.flatMap(l => l.columns)
  return {
    tables: names.length && names.every(n => n === n.toUpperCase() && /[A-Z]/.test(n)) ? 'upper' : names.some(n => /^[A-Z][a-z]/.test(n)) ? 'pascal' : 'snake',
    pk: pks.length && pks.filter(n => lc(n) === 'id').length >= pks.length / 2 ? 'id' : 'keep',
    fk: fkCols.filter(n => /^id_/i.test(n)).length > fkCols.filter(n => /_id$/i.test(n)).length ? 'id_table' : 'table_id',
    join: 'tables'
  }
}

/**
 * A database as an MCD and its MPD. A table whose key is made of foreign keys
 * to two tables or more is an association; any other foreign key is an
 * association between its two tables, 1,1 (0,1 when it can be empty) — 0,n.
 */
export function importDb(db: DbDiagram, engine: SqlEngine, mcdFile: string): { mcd: McdModel; naming: MldNaming; mpd: MpdModel } {
  const tables = dbTablesOf(db)
  const key = (t: { schema: string; name: string }) => `${t.schema}.${t.name}`
  const keys = new Set(tables.map(key))
  const links = db.links.filter(l => keys.has(key(l.from)) && keys.has(key(l.to)))
  const naming = guessNaming({ ...db, links })
  const pos = autoLayout(tables, links)
  const upper = (s: string) => snake(s).toUpperCase()
  const isJoin = (t: DbDiagramTable) => {
    const pk = t.columns.filter(c => c.pk).map(c => c.name)
    const fks = links.filter(l => key(l.from) === key(t))
    return fks.length >= 2 && pk.length >= 2 && pk.every(n => fks.some(f => f.columns.includes(n)))
  }

  const mcd: McdModel = { entities: [], associations: [], links: [], notes: [] }
  const entityOf = new Map<string, string>()
  /** MCD ids → database names, to give the MPD the database's names */
  const tableName = new Map<string, string>()
  const colName = new Map<string, string>()
  const attrOf = new Map<string, string>()
  let n = 0
  const id = (p: string) => `${p}${(++n).toString(36)}`
  const attribute = (t: DbDiagramTable, c: DbDiagramTable['columns'][number], identifier: boolean): McdAttribute => {
    const a: McdAttribute = {
      id: id('a'), name: identifier && lc(c.name) === 'id' && t.columns.filter(x => x.pk).length === 1 ? `id_${snake(t.name)}` : c.name,
      ...mcdType(parseSqlType(c.type) ?? { type: 'text' }), ...(identifier ? { identifier: true } : {})
    }
    attrOf.set(`${key(t)}.${lc(c.name)}`, a.id)
    colName.set(a.id, c.name)
    return a
  }

  const usable = (l: DbDiagramLink) => !isJoin(tables.find(t => key(t) === key(l.to))!)
  for (const t of tables.filter(x => !isJoin(x))) {
    const fkCols = new Set(links.filter(l => key(l.from) === key(t) && usable(l)).flatMap(l => l.columns.map(lc)))
    const e = { id: id('e'), name: upper(t.name), x: pos[key(t)]?.x ?? 0, y: pos[key(t)]?.y ?? 0, attributes: [] as McdAttribute[] }
    for (const c of t.columns) if (c.pk || !fkCols.has(lc(c.name))) e.attributes.push(attribute(t, c, c.pk))
    mcd.entities.push(e)
    entityOf.set(key(t), e.id)
    tableName.set(e.id, t.name)
  }
  const middle = (ids: string[]) => {
    const es = ids.map(i => mcd.entities.find(x => x.id === i)!)
    return { x: Math.round(es.reduce((s, x) => s + x.x, 0) / es.length) + 40, y: Math.round(es.reduce((s, x) => s + x.y, 0) / es.length) + 40 }
  }
  const leg = (entity: string, association: string, card: Cardinality) => { const l = { id: id('l'), entity, association, card }; mcd.links.push(l); return l }
  /** The foreign key's columns, named in the MPD after the leg and the identifier they point at */
  const mapFk = (l: DbDiagramLink, legId: string) => l.columns.forEach((c, i) => {
    const target = attrOf.get(`${key(l.to)}.${lc(l.refColumns[i] ?? '')}`)
    if (target) colName.set(`${legId}:${target}`, c)
  })

  for (const t of tables.filter(isJoin)) {
    // In the table's column order (SQLite lists its keys backwards)
    const at = (l: DbDiagramLink) => t.columns.findIndex(c => c.name === l.columns[0])
    const fks = links.filter(l => key(l.from) === key(t)).sort((a, b) => at(a) - at(b))
    const fkCols = new Set(fks.flatMap(l => l.columns.map(lc)))
    const a = { id: id('s'), name: upper(t.name), ...middle(fks.map(l => entityOf.get(key(l.to))!).filter(Boolean)), attributes: t.columns.filter(c => !fkCols.has(lc(c.name))).map(c => attribute(t, c, false)) }
    mcd.associations.push(a)
    tableName.set(a.id, t.name)
    for (const f of fks) { const to = entityOf.get(key(f.to)); if (to) mapFk(f, leg(to, a.id, '0,n').id) }
  }
  for (const f of links) {
    const child = tables.find(t => key(t) === key(f.from))!
    const parent = entityOf.get(key(f.to))
    if (isJoin(child) || !parent || !usable(f)) continue
    if (f.columns.every(c => child.columns.find(x => x.name === c)?.pk)) continue
    const childId = entityOf.get(key(child))!
    const nullable = f.columns.some(c => child.columns.find(x => x.name === c)?.nullable)
    const a = { id: id('s'), name: `${upper(child.name)}_${upper(f.to.name)}`, ...middle([childId, parent]), attributes: [] }
    mcd.associations.push(a)
    leg(childId, a.id, nullable ? '0,1' : '1,1')
    mapFk(f, leg(parent, a.id, '0,n').id)
  }

  // The MPD from that MCD, then with the database's own names and types
  const made = generateMpd(mcd, naming, engine, null, mcdFile)
  const renamed: MpdModel = {
    ...made,
    tables: made.tables.map(t => {
      const name = (t.from && tableName.get(t.from)) || t.name
      return {
        ...t, name, ...(name !== t.name ? { edited: true } : {}),
        columns: t.columns.map(c => {
          const real = c.from ? colName.get(c.from) : undefined
          return real && real !== c.name ? { ...c, name: real, edited: true } : c
        })
      }
    })
  }
  return { mcd, naming, mpd: adoptDb(renamed, db) }
}
