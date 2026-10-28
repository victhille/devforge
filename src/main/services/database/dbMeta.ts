import type {
  DbColumnInfo, DbDiagram, DbDiagramLink, DbDiagramTable, DbForeignKey, DbIndexInfo, DbOverview, DbTableDetails, DbTableRef, DbTableStat, DbType
} from '@shared/types'
import { quoteColumn, quoteIdent } from '@shared/lib/sqlQuote'

/** Parameterized query returning rows as objects */
export type Raw = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))
const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** Column keys derived from indexes, like MySQL's COLUMN_KEY */
function keysFromIndexes(indexes: DbIndexInfo[]): Map<string, DbColumnInfo['key']> {
  const keys = new Map<string, DbColumnInfo['key']>()
  for (const i of indexes) if (i.primary) for (const c of i.columns) keys.set(c, 'PRI')
  for (const i of indexes) if (i.unique && !i.primary && i.columns.length === 1 && !keys.has(i.columns[0])) keys.set(i.columns[0], 'UNI')
  for (const i of indexes) if (!i.unique && i.columns[0] && !keys.has(i.columns[0])) keys.set(i.columns[0], 'MUL')
  return keys
}

/** Group rows of (constraint, column, referenced column) into foreign keys */
function groupFks(rows: Record<string, unknown>[], tableField: string): DbForeignKey[] {
  const map = new Map<string, DbForeignKey>()
  for (const r of rows) {
    const name = str(r.name)
    const key = `${str(r[tableField])}|${name}`
    if (!map.has(key)) map.set(key, { name, table: str(r[tableField]), columns: [], refColumns: [], onUpdate: str(r.upd), onDelete: str(r.del) })
    map.get(key)!.columns.push(str(r.col))
    map.get(key)!.refColumns.push(str(r.refcol))
  }
  return [...map.values()]
}

// ─── MySQL / MariaDB ──────────────────────────────────────────────────────────

const mysql = {
  async overview(raw: Raw, version: string): Promise<DbOverview> {
    const [db] = await raw(
      `SELECT DATABASE() d, s.DEFAULT_CHARACTER_SET_NAME cs, s.DEFAULT_COLLATION_NAME co
       FROM information_schema.SCHEMATA s WHERE s.SCHEMA_NAME = DATABASE()`)
    const tables = (await raw(
      `SELECT TABLE_NAME n, TABLE_TYPE ty, TABLE_ROWS r, DATA_LENGTH dl, INDEX_LENGTH il, ENGINE e, TABLE_COLLATION co, TABLE_COMMENT cm
       FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`)).map((r): DbTableStat => ({
      name: str(r.n), schema: '', type: r.ty === 'VIEW' ? 'view' : 'table',
      rows: num(r.r), dataBytes: num(r.dl), indexBytes: num(r.il),
      engine: str(r.e) || undefined, collation: str(r.co) || undefined, comment: str(r.cm) || undefined
    }))
    const size = tables.reduce((s, t) => s + (t.dataBytes ?? 0) + (t.indexBytes ?? 0), 0)
    return { version, database: str(db?.d), sizeBytes: size, encoding: str(db?.cs) || undefined, collation: str(db?.co) || undefined, tables }
  },

  async details(raw: Raw, t: DbTableRef, stats: DbTableStat | null): Promise<DbTableDetails> {
    const columns = (await raw(
      `SELECT COLUMN_NAME n, COLUMN_TYPE ty, IS_NULLABLE nu, COLUMN_DEFAULT df, COLUMN_KEY k, EXTRA ex, COLUMN_COMMENT cm
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`, [t.name]))
      .map((r): DbColumnInfo => ({
        // MariaDB reports a NULL default as the text 'NULL'
        name: str(r.n), type: str(r.ty), nullable: r.nu === 'YES', default: r.df === null || r.df === 'NULL' ? null : str(r.df),
        key: (['PRI', 'UNI', 'MUL'].includes(str(r.k)) ? str(r.k) : '') as DbColumnInfo['key'], extra: str(r.ex), comment: str(r.cm)
      }))
    const idx = new Map<string, DbIndexInfo>()
    for (const r of await raw(
      `SELECT INDEX_NAME n, NON_UNIQUE nu, COLUMN_NAME c, INDEX_TYPE ty FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY INDEX_NAME = 'PRIMARY' DESC, INDEX_NAME, SEQ_IN_INDEX`, [t.name])) {
      const name = str(r.n)
      if (!idx.has(name)) idx.set(name, { name, columns: [], unique: Number(r.nu) === 0, primary: name === 'PRIMARY', type: str(r.ty) })
      idx.get(name)!.columns.push(str(r.c))
    }
    const fkSql = (where: string, tableCol: string) =>
      `SELECT k.CONSTRAINT_NAME name, ${tableCol} tbl, k.COLUMN_NAME col, k.REFERENCED_COLUMN_NAME refcol, r.UPDATE_RULE upd, r.DELETE_RULE del
       FROM information_schema.KEY_COLUMN_USAGE k
       JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME
       WHERE k.TABLE_SCHEMA = DATABASE() AND ${where} ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`
    const foreignKeys = groupFks(await raw(fkSql('k.TABLE_NAME = ?', 'k.REFERENCED_TABLE_NAME'), [t.name]), 'tbl')
    // "Referenced by": columns are the other table's, refColumns ours
    const referencedBy = groupFks(await raw(fkSql('k.REFERENCED_TABLE_NAME = ?', 'k.TABLE_NAME'), [t.name]), 'tbl')
    let ddl: string | null = null
    try {
      const [row] = await raw(`SHOW CREATE TABLE ${quoteIdent('mysql', t)}`)
      ddl = str(row?.['Create Table'] ?? row?.['Create View']) || null
    } catch { /* no privilege */ }
    return { columns, indexes: [...idx.values()], foreignKeys, referencedBy, ddl, stats }
  }
}

// ─── PostgreSQL ───────────────────────────────────────────────────────────────

const PG_FK_ACTION: Record<string, string> = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }
const PG_REL = `format('%I.%I', $1::text, $2::text)::regclass`

const postgres = {
  async overview(raw: Raw, version: string): Promise<DbOverview> {
    const [db] = await raw(
      `SELECT current_database() d, pg_database_size(current_database()) sz, pg_encoding_to_char(encoding) enc, datcollate co
       FROM pg_database WHERE datname = current_database()`)
    const tables = (await raw(
      `SELECT n.nspname s, c.relname n, c.relkind k, c.reltuples::bigint r,
              pg_table_size(c.oid) dl, pg_indexes_size(c.oid) il, obj_description(c.oid, 'pg_class') cm
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relkind IN ('r', 'p', 'v', 'm') AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
       ORDER BY n.nspname, c.relname`)).map((r): DbTableStat => ({
      name: str(r.n), schema: str(r.s), type: r.k === 'v' || r.k === 'm' ? 'view' : 'table',
      // -1 = never analyzed
      rows: num(r.r) !== null && Number(r.r) >= 0 ? Number(r.r) : null,
      dataBytes: num(r.dl), indexBytes: num(r.il), comment: str(r.cm) || undefined
    }))
    return { version, database: str(db?.d), sizeBytes: num(db?.sz), encoding: str(db?.enc) || undefined, collation: str(db?.co) || undefined, tables }
  },

  async details(raw: Raw, t: DbTableRef, stats: DbTableStat | null): Promise<DbTableDetails> {
    const p = [t.schema || 'public', t.name]
    const indexes = (await raw(
      `SELECT i.relname n, ix.indisunique u, ix.indisprimary pk, am.amname ty,
              ARRAY(SELECT a.attname::text FROM unnest(ix.indkey) WITH ORDINALITY k(attnum, o)
                    JOIN pg_attribute a ON a.attrelid = ix.indrelid AND a.attnum = k.attnum ORDER BY k.o) cols
       FROM pg_index ix JOIN pg_class i ON i.oid = ix.indexrelid JOIN pg_am am ON am.oid = i.relam
       WHERE ix.indrelid = ${PG_REL} ORDER BY ix.indisprimary DESC, i.relname`, p))
      .map((r): DbIndexInfo => ({ name: str(r.n), columns: (r.cols as string[]) ?? [], unique: !!r.u, primary: !!r.pk, type: str(r.ty) }))
    const keys = keysFromIndexes(indexes)
    const columns = (await raw(
      `SELECT a.attname n, format_type(a.atttypid, a.atttypmod) ty, NOT a.attnotnull nu, pg_get_expr(d.adbin, d.adrelid) df,
              col_description(a.attrelid, a.attnum) cm, a.attidentity idn, a.attgenerated gen
       FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
       WHERE a.attrelid = ${PG_REL} AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, p))
      .map((r): DbColumnInfo => {
        const df = r.df === null ? null : str(r.df)
        const extra = r.idn === 'a' ? 'identity always' : r.idn === 'd' ? 'identity' : r.gen === 's' ? 'generated' : df?.startsWith('nextval(') ? 'auto_increment' : ''
        return { name: str(r.n), type: str(r.ty), nullable: !!r.nu, default: df, key: keys.get(str(r.n)) ?? '', extra, comment: str(r.cm) }
      })
    const fkSql = (relCol: 'conrelid' | 'confrelid', otherCol: 'conrelid' | 'confrelid') =>
      `SELECT con.conname name, con.${otherCol}::regclass::text tbl, con.confupdtype upd, con.confdeltype del,
              ARRAY(SELECT a.attname::text FROM unnest(con.conkey) WITH ORDINALITY k(n, o)
                    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n ORDER BY k.o) cols,
              ARRAY(SELECT a.attname::text FROM unnest(con.confkey) WITH ORDINALITY k(n, o)
                    JOIN pg_attribute a ON a.attrelid = con.confrelid AND a.attnum = k.n ORDER BY k.o) refcols
       FROM pg_constraint con WHERE con.contype = 'f' AND con.${relCol} = ${PG_REL} ORDER BY con.conname`
    const toFk = (r: Record<string, unknown>): DbForeignKey => ({
      name: str(r.name), table: str(r.tbl), columns: (r.cols as string[]) ?? [], refColumns: (r.refcols as string[]) ?? [],
      onUpdate: PG_FK_ACTION[str(r.upd)] ?? str(r.upd), onDelete: PG_FK_ACTION[str(r.del)] ?? str(r.del)
    })
    const foreignKeys = (await raw(fkSql('conrelid', 'confrelid'), p)).map(toFk)
    const referencedBy = (await raw(fkSql('confrelid', 'conrelid'), p)).map(toFk)
    return { columns, indexes, foreignKeys, referencedBy, ddl: pgDdl(t, columns, indexes, foreignKeys), stats }
  }
}

/** Readable CREATE TABLE rebuilt from the catalog (PostgreSQL has no SHOW CREATE) */
function pgDdl(t: DbTableRef, columns: DbColumnInfo[], indexes: DbIndexInfo[], fks: DbForeignKey[]): string {
  const q = (s: string) => quoteColumn('postgres', s)
  const lines = columns.map(c =>
    `  ${q(c.name)} ${c.type}${c.extra.startsWith('identity') ? ` GENERATED ${c.extra === 'identity always' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY` : ''}` +
    `${c.nullable ? '' : ' NOT NULL'}${c.default !== null ? ` DEFAULT ${c.default}` : ''}`)
  const pk = indexes.find(i => i.primary)
  if (pk) lines.push(`  PRIMARY KEY (${pk.columns.map(q).join(', ')})`)
  for (const f of fks) {
    lines.push(`  CONSTRAINT ${q(f.name)} FOREIGN KEY (${f.columns.map(q).join(', ')}) REFERENCES ${f.table} (${f.refColumns.map(q).join(', ')})` +
      `${f.onUpdate !== 'NO ACTION' ? ` ON UPDATE ${f.onUpdate}` : ''}${f.onDelete !== 'NO ACTION' ? ` ON DELETE ${f.onDelete}` : ''}`)
  }
  const extra = indexes.filter(i => !i.primary).map(i =>
    `CREATE ${i.unique ? 'UNIQUE ' : ''}INDEX ${q(i.name)} ON ${quoteIdent('postgres', t)} USING ${i.type} (${i.columns.map(q).join(', ')});`)
  return [`CREATE TABLE ${quoteIdent('postgres', t)} (\n${lines.join(',\n')}\n);`, ...extra].join('\n')
}

// ─── SQLite ───────────────────────────────────────────────────────────────────

const sqlite = {
  async overview(raw: Raw, version: string, file: string): Promise<DbOverview> {
    const [size] = await raw('SELECT page_count * page_size s FROM pragma_page_count(), pragma_page_size()')
    const objs = await raw(`SELECT name n, type ty FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    const tables: DbTableStat[] = []
    for (const o of objs) {
      const [c] = await raw(`SELECT COUNT(*) c FROM ${quoteIdent('sqlite', { name: str(o.n), schema: '' })}`).catch(() => [{ c: null }])
      tables.push({ name: str(o.n), schema: '', type: o.ty === 'view' ? 'view' : 'table', rows: num(c?.c), dataBytes: null, indexBytes: null })
    }
    const [enc] = await raw('PRAGMA encoding')
    return { version, database: file.split(/[\\/]/).pop() ?? file, sizeBytes: num(size?.s), encoding: str(enc?.encoding) || undefined, tables }
  },

  async details(raw: Raw, t: DbTableRef, stats: DbTableStat | null): Promise<DbTableDetails> {
    const lit = `'${t.name.replace(/'/g, "''")}'`
    const indexes: DbIndexInfo[] = []
    for (const i of await raw(`SELECT name n, "unique" u, origin o FROM pragma_index_list(${lit})`)) {
      const cols = (await raw(`SELECT name n FROM pragma_index_info('${str(i.n).replace(/'/g, "''")}') ORDER BY seqno`)).map(c => str(c.n))
      indexes.push({ name: str(i.n), columns: cols, unique: Number(i.u) === 1, primary: i.o === 'pk', type: 'btree' })
    }
    const info = await raw(`SELECT name n, type ty, "notnull" nn, dflt_value df, pk FROM pragma_table_info(${lit}) ORDER BY cid`)
    const pkCols = info.filter(r => Number(r.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map(r => str(r.n))
    if (pkCols.length && !indexes.some(i => i.primary)) indexes.unshift({ name: 'PRIMARY', columns: pkCols, unique: true, primary: true, type: 'btree' })
    const keys = keysFromIndexes(indexes)
    const [def] = await raw(`SELECT sql FROM sqlite_master WHERE name = ${lit}`)
    const autoInc = /AUTOINCREMENT/i.test(str(def?.sql))
    const columns = info.map((r): DbColumnInfo => ({
      name: str(r.n), type: str(r.ty), nullable: Number(r.nn) === 0 && Number(r.pk) === 0, default: r.df === null ? null : str(r.df),
      key: keys.get(str(r.n)) ?? '', extra: autoInc && pkCols.length === 1 && pkCols[0] === str(r.n) ? 'autoincrement' : '', comment: ''
    }))
    const fk = (rows: Record<string, unknown>[], table: string): DbForeignKey[] => groupFks(rows.map(r => ({
      name: `fk_${r.id}`, tbl: table || r.table, col: r.from, refcol: r.to, upd: r.on_update, del: r.on_delete
    })), 'tbl')
    const foreignKeys = fk(await raw(`SELECT * FROM pragma_foreign_key_list(${lit}) ORDER BY id, seq`), '')
    const referencedBy: DbForeignKey[] = []
    for (const o of await raw(`SELECT name n FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)) {
      const rows = (await raw(`SELECT * FROM pragma_foreign_key_list('${str(o.n).replace(/'/g, "''")}') ORDER BY id, seq`)).filter(r => r.table === t.name)
      // Seen from the other table: its columns point at ours
      referencedBy.push(...fk(rows, str(o.n)))
    }
    return { columns, indexes, foreignKeys, referencedBy, ddl: str(def?.sql) || null, stats }
  }
}

// ─── Schema (v3.8) ────────────────────────────────────────────────────────────

/** Tables and links from flat rows; links to tables not shown (another schema or database) are left out */
function diagramOf(cols: { s: string; t: string; view: boolean; n: string; ty: string; nu: boolean; pk: boolean }[], fks: { name: string; s: string; t: string; rs: string; rt: string; col: string; refcol: string }[]): DbDiagram {
  const tables = new Map<string, DbDiagramTable>()
  for (const c of cols) {
    const key = `${c.s}.${c.t}`
    if (!tables.has(key)) tables.set(key, { name: c.t, schema: c.s, type: c.view ? 'view' : 'table', columns: [] })
    tables.get(key)!.columns.push({ name: c.n, type: c.ty, nullable: c.nu, pk: c.pk })
  }
  const links = new Map<string, DbDiagramLink>()
  for (const f of fks) {
    if (!tables.has(`${f.s}.${f.t}`) || !tables.has(`${f.rs}.${f.rt}`)) continue
    const key = `${f.s}.${f.t}|${f.name}`
    if (!links.has(key)) links.set(key, { from: { schema: f.s, name: f.t }, columns: [], to: { schema: f.rs, name: f.rt }, refColumns: [] })
    links.get(key)!.columns.push(f.col)
    // SQLite: no column named = the primary key
    links.get(key)!.refColumns.push(f.refcol || tables.get(`${f.rs}.${f.rt}`)!.columns.find(c => c.pk)?.name || '')
  }
  return { tables: [...tables.values()], links: [...links.values()] }
}

export async function diagramFor(type: DbType, raw: Raw): Promise<DbDiagram> {
  if (type === 'mysql') {
    const cols = await raw(
      `SELECT c.TABLE_NAME t, c.COLUMN_NAME n, c.COLUMN_TYPE ty, c.IS_NULLABLE nu, c.COLUMN_KEY k, tb.TABLE_TYPE tt
       FROM information_schema.COLUMNS c JOIN information_schema.TABLES tb ON tb.TABLE_SCHEMA = c.TABLE_SCHEMA AND tb.TABLE_NAME = c.TABLE_NAME
       WHERE c.TABLE_SCHEMA = DATABASE() ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`)
    const fks = await raw(
      `SELECT CONSTRAINT_NAME name, TABLE_NAME t, REFERENCED_TABLE_NAME rt, COLUMN_NAME col, REFERENCED_COLUMN_NAME refcol
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY TABLE_NAME, CONSTRAINT_NAME, ORDINAL_POSITION`)
    return diagramOf(
      cols.map(r => ({ s: '', t: str(r.t), view: r.tt === 'VIEW', n: str(r.n), ty: str(r.ty), nu: r.nu === 'YES', pk: r.k === 'PRI' })),
      fks.map(r => ({ name: str(r.name), s: '', t: str(r.t), rs: '', rt: str(r.rt), col: str(r.col), refcol: str(r.refcol) })))
  }
  if (type === 'postgres') {
    const cols = await raw(
      `SELECT n.nspname s, c.relname t, c.relkind k, a.attname n, format_type(a.atttypid, a.atttypmod) ty, NOT a.attnotnull nu,
              EXISTS (SELECT 1 FROM pg_index ix WHERE ix.indrelid = c.oid AND ix.indisprimary AND a.attnum = ANY(ix.indkey)) pk
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE c.relkind IN ('r', 'p', 'v', 'm') AND NOT c.relispartition
         AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
       ORDER BY n.nspname, c.relname, a.attnum`)
    const fks = await raw(
      `SELECT con.conname name, sn.nspname s, sc.relname t, tn.nspname rs, tc.relname rt, k.o, a.attname::text col, fa.attname::text refcol
       FROM pg_constraint con
       JOIN pg_class sc ON sc.oid = con.conrelid JOIN pg_namespace sn ON sn.oid = sc.relnamespace
       JOIN pg_class tc ON tc.oid = con.confrelid JOIN pg_namespace tn ON tn.oid = tc.relnamespace
       CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY k(n, fn, o)
       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.n
       JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = k.fn
       WHERE con.contype = 'f' AND sn.nspname NOT IN ('pg_catalog', 'information_schema')
       ORDER BY sn.nspname, sc.relname, con.conname, k.o`)
    return diagramOf(
      cols.map(r => ({ s: str(r.s), t: str(r.t), view: r.k === 'v' || r.k === 'm', n: str(r.n), ty: str(r.ty), nu: !!r.nu, pk: !!r.pk })),
      fks.map(r => ({ name: str(r.name), s: str(r.s), t: str(r.t), rs: str(r.rs), rt: str(r.rt), col: str(r.col), refcol: str(r.refcol) })))
  }
  const cols: Parameters<typeof diagramOf>[0] = []
  const fks: Parameters<typeof diagramOf>[1] = []
  for (const o of await raw(`SELECT name n, type ty FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name`)) {
    const lit = `'${str(o.n).replace(/'/g, "''")}'`
    for (const r of await raw(`SELECT name n, type ty, "notnull" nn, pk FROM pragma_table_info(${lit}) ORDER BY cid`)) {
      cols.push({ s: '', t: str(o.n), view: o.ty === 'view', n: str(r.n), ty: str(r.ty), nu: Number(r.nn) === 0 && Number(r.pk) === 0, pk: Number(r.pk) > 0 })
    }
    if (o.ty === 'view') continue
    for (const r of await raw(`SELECT * FROM pragma_foreign_key_list(${lit}) ORDER BY id, seq`)) {
      fks.push({ name: `fk_${r.id}`, s: '', t: str(o.n), rs: '', rt: str(r.table), col: str(r.from), refcol: str(r.to) })
    }
  }
  return diagramOf(cols, fks)
}

export async function overviewFor(type: DbType, raw: Raw, version: string, file = ''): Promise<DbOverview> {
  return type === 'mysql' ? mysql.overview(raw, version) : type === 'postgres' ? postgres.overview(raw, version) : sqlite.overview(raw, version, file)
}

export async function detailsFor(type: DbType, raw: Raw, t: DbTableRef, stats: DbTableStat | null): Promise<DbTableDetails> {
  return type === 'mysql' ? mysql.details(raw, t, stats) : type === 'postgres' ? postgres.details(raw, t, stats) : sqlite.details(raw, t, stats)
}
