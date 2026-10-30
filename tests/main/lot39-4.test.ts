import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import initSqlJs, { type Database } from 'sql.js'
import type { MpdModel } from '@shared/types'
import { DEFAULT_NAMING, generateMpd, mcdHash, mpdSql, toMld } from '@shared/lib/mpd'
import { adoptDb, diffMpd, diffScript, guessNaming, importDb, parseSqlType, sameType } from '@shared/lib/mpdDb'
import { diagramFor } from '../../src/main/services/database/dbMeta'
import { shop } from '../shopMcd'
import { doctrineMigration } from '../../src/main/services/modeling/linked'
import { saveProjects, tempDir } from '../helpers'

/** v3.9 lot 4: the MPD against a real database (SQLite here; PostgreSQL and MySQL checked by hand) */

const NOTES = { pk: 'pk {table}', fkExtra: 'fk {table} {db}', sqliteType: 'type {table}.{column}', sqliteFk: 'fk {table} {mpd}' }

async function sqlite(sql = ''): Promise<Database> {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('PRAGMA foreign_keys = ON')
  if (sql) db.run(sql)
  return db
}
const diagram = (db: Database) => diagramFor('sqlite', async sql => {
  const r = db.exec(sql)[0]
  return r ? r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []
})
const run = (db: Database, mpd: MpdModel, diffs: ReturnType<typeof diffMpd>) => {
  for (const l of diffScript(mpd, diffs, NOTES)) if (!l.comment) db.run(l.sql)
}

describe('types as databases report them', () => {
  it('reads PostgreSQL, MySQL and SQLite spellings', () => {
    expect(parseSqlType('character varying(80)')).toEqual({ type: 'varchar', length: 80 })
    expect(parseSqlType('numeric(10,2)')).toEqual({ type: 'decimal', length: 10, scale: 2 })
    expect(parseSqlType('timestamp without time zone')).toEqual({ type: 'datetime' })
    expect(parseSqlType('time without time zone')).toEqual({ type: 'time' })
    expect(parseSqlType('int(11) unsigned')).toEqual({ type: 'int' })
    expect(parseSqlType('tinyint(1)')).toEqual({ type: 'bool' })
    expect(parseSqlType('jsonb')).toEqual({ type: 'json' })
    expect(parseSqlType('geometry')).toBeNull()
    expect(sameType({ type: 'varchar', length: 80 }, 'TEXT', 'sqlite')).toBe(true)
    expect(sameType({ type: 'varchar', length: 80 }, 'varchar(120)', 'mysql')).toBe(false)
    expect(sameType({ type: 'uuid' }, 'char(36)', 'mysql')).toBe(true)
  })
})

describe('the MPD and its database', () => {
  it('nothing differs once the script ran', async () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'sqlite')
    const db = await sqlite(mpdSql(mpd))
    expect(diffMpd(mpd, await diagram(db))).toEqual([])
  })

  it('lists each difference, and the script catches up', async () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'sqlite')
    const db = await sqlite(mpdSql({ ...mpd, tables: mpd.tables.filter(t => t.name !== 'avis') }))
    db.run('ALTER TABLE produit ADD COLUMN vieux TEXT; CREATE TABLE trace (id INTEGER PRIMARY KEY, quoi TEXT)')
    const client = mpd.tables.find(t => t.name === 'client')!
    client.columns.push({ id: 'c-x', name: 'telephone', type: 'varchar', length: 20, nullable: true })
    const diffs = diffMpd(mpd, await diagram(db))
    expect(diffs.map(d => `${d.kind}:${d.table}${d.column ? `.${d.column}` : ''}${d.danger ? '!' : ''}`).sort()).toEqual([
      'columnExtra:produit.vieux!', 'columnMissing:client.telephone', 'tableExtra:trace!', 'tableMissing:avis'
    ])
    const script = diffScript(mpd, diffs, NOTES)
    expect(script.filter(l => l.danger).map(l => l.sql)).toEqual(['ALTER TABLE produit DROP COLUMN vieux;', 'DROP TABLE trace;'])
    expect(script[0].sql).toMatch(/^CREATE TABLE avis/)
    run(db, mpd, diffs)
    expect(diffMpd(mpd, await diagram(db))).toEqual([])
  })

  it('what SQLite cannot change is left as a note', async () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'sqlite')
    const db = await sqlite(mpdSql(mpd))
    const prix = mpd.tables.find(t => t.name === 'produit')!.columns.find(c => c.name === 'prix')!
    prix.type = 'int'
    const diffs = diffMpd(mpd, await diagram(db))
    expect(diffs).toEqual([{ kind: 'type', table: 'produit', column: 'prix', mpd: 'INTEGER', db: 'NUMERIC' }])
    expect(diffScript(mpd, diffs, NOTES)).toEqual([{ sql: '-- type produit.prix', comment: true }])
    // The same change, on PostgreSQL and MySQL
    const pg = { ...mpd, engine: 'postgres' as const }
    expect(diffScript(pg, [{ kind: 'type', table: 'produit', column: 'prix', mpd: 'INTEGER', db: 'NUMERIC(10,2)' }], NOTES).map(l => l.sql))
      .toEqual(['ALTER TABLE produit ALTER COLUMN prix TYPE INTEGER USING prix::INTEGER;'])
    const my = { ...mpd, engine: 'mysql' as const }
    expect(diffScript(my, [{ kind: 'nullable', table: 'produit', column: 'prix', mpd: 'NULL', db: 'NOT NULL' }], NOTES).map(l => l.sql))
      .toEqual(['ALTER TABLE produit MODIFY COLUMN prix INT;'])
  })

  it('the database taken into the MPD keeps ties to the MCD, and an update keeps it', async () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'sqlite', null, 'boutique.mcd.json')
    const db = await sqlite(mpdSql(mpd))
    db.run('ALTER TABLE produit ADD COLUMN poids REAL; CREATE TABLE trace (id INTEGER PRIMARY KEY, quoi TEXT NOT NULL)')
    const taken = adoptDb(mpd, await diagram(db))
    expect(diffMpd(taken, await diagram(db))).toEqual([])
    const produit = taken.tables.find(t => t.name === 'produit')!
    expect(produit.id).toBe(mpd.tables.find(t => t.name === 'produit')!.id)
    expect(produit.columns.find(c => c.name === 'poids')).toMatchObject({ type: 'float', nullable: true, edited: true })
    expect(produit.columns.find(c => c.name === 'categorie_id')).toMatchObject({ from: expect.any(String), ref: { table: 't-ca' } })
    expect(taken.tables.find(t => t.name === 'avis')?.from).toBe('av')
    expect(taken.tables.find(t => t.name === 'trace')).toMatchObject({ columns: [{ name: 'id', pk: true }, { name: 'quoi', type: 'text' }] })
    expect(taken.tables.find(t => t.name === 'trace')!.from).toBeUndefined()
    // Made again from the MCD: what came from the database stays
    const again = generateMpd(shop(), DEFAULT_NAMING, 'sqlite', taken, 'boutique.mcd.json')
    expect(diffMpd(again, await diagram(db))).toEqual([])
  })
})

describe('a database read back as an MCD', () => {
  it('link tables become associations, foreign keys 1,1 — 0,n legs; its MPD is the database', async () => {
    const db = await sqlite(mpdSql(generateMpd(shop(), DEFAULT_NAMING, 'sqlite')))
    const d = await diagram(db)
    expect(guessNaming(d)).toEqual(DEFAULT_NAMING)
    const { mcd, naming, mpd } = importDb(d, 'sqlite', 'boutique.mcd.json')
    expect(mcd.entities.map(e => e.name).sort()).toEqual(['ADRESSE', 'AVIS', 'CATEGORIE', 'CLIENT', 'COMMANDE', 'PRODUIT'])
    expect(mcd.associations.map(a => a.name).sort()).toEqual(['ADRESSE_CLIENT', 'AVIS_CLIENT', 'COMMANDE_CLIENT', 'COMMANDE_PRODUIT', 'PRODUIT_CATEGORIE'])
    const join = mcd.associations.find(a => a.name === 'COMMANDE_PRODUIT')!
    expect(join.attributes.map(a => a.name)).toEqual(['quantite'])
    expect(mcd.links.filter(l => l.association === join.id).map(l => l.card)).toEqual(['0,n', '0,n'])
    const client = mcd.entities.find(e => e.name === 'CLIENT')!
    expect(client.attributes[0]).toMatchObject({ name: 'id_client', identifier: true, type: 'int' })
    expect(toMld(mcd).relations).toHaveLength(7)
    // The MPD is the database, and stays so when made again from the MCD
    expect(diffMpd(mpd, d)).toEqual([])
    expect(mpd.sourceHash).toBe(mcdHash(mcd, naming))
    expect(diffMpd(generateMpd(mcd, naming, 'sqlite', mpd, 'boutique.mcd.json'), d)).toEqual([])
  })
})

describe('a Symfony project: a Doctrine migration rather than a direct change', () => {
  it('writes the statements in migrations/, and only for Symfony', () => {
    const project = tempDir('shop')
    const other = tempDir('front')
    saveProjects([{ name: 'shop', path: project, framework: 'symfony' }, { name: 'front', path: other }])
    const path = doctrineMigration(project, ['-- a note', "ALTER TABLE produit ADD COLUMN nom VARCHAR(80) DEFAULT 'l''été';", 'DROP TABLE trace;'], 'DevForge : boutique', new Date(2026, 9, 30, 8, 5, 9))
    expect(path).toBe(join(project, 'migrations', 'Version20261030080509.php'))
    const php = readFileSync(path, 'utf-8')
    expect(php).toContain('final class Version20261030080509 extends AbstractMigration')
    expect(php).toContain(String.raw`$this->addSql('ALTER TABLE produit ADD COLUMN nom VARCHAR(80) DEFAULT \'l\'\'été\'');`)
    expect(php).toContain("$this->addSql('DROP TABLE trace');")
    expect(php).not.toContain('a note')
    // Same second: the next one
    expect(doctrineMigration(project, ['DROP TABLE x;'], 'x', new Date(2026, 9, 30, 8, 5, 9))).toMatch(/Version20261030080510\.php$/)
    expect(() => doctrineMigration(other, ['DROP TABLE x;'], 'x')).toThrow(/Symfony/)
  })
})
