import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import initSqlJs from 'sql.js'
import type { McdModel } from '@shared/types'
import { checkMpd, cleanMpd, DEFAULT_NAMING, generateMpd, mcdHash, mpdDiagram, mpdSql, quoteName, sqlType, toMld } from '@shared/lib/mpd'
import { attr, identifier as id, shop } from '../shopMcd'
import { createModel, listModels, projectEngine, readModel, renameModel, saveModel, writeSql } from '../../src/main/services/modeling/models'
import { saveProjects, tempDir } from '../helpers'

/** v3.9 lot 3: MLD and MPD made from the MCD, and the SQL */

const line = (m: McdModel, name: string) => {
  const r = toMld(m).relations.find(x => x.name === name)!
  return r.columns.map(c => `${c.pk ? '_' : ''}${c.fk ? '#' : ''}${c.name}`).join(', ')
}

describe('the MLD', () => {
  it('turns entities into relations and 1,1 legs into foreign keys', () => {
    const m = shop()
    expect(line(m, 'CLIENT')).toBe('_id_client, nom, email, inscrit_le')
    expect(line(m, 'COMMANDE')).toBe('_id_commande, passee_le, statut, #id_client')
    expect(line(m, 'PRODUIT')).toBe('_id_produit, libelle, prix, stock, #id_categorie')
    // The association's own attribute follows the key into the entity
    expect(line(m, 'AVIS')).toBe('_id_avis, note, commentaire, #id_client, ecrit_le')
  })

  it('turns an n-n association into a relation keyed by both sides', () => {
    expect(line(shop(), 'CONTENIR')).toBe('_#id_commande, _#id_produit, quantite')
    const rules = toMld(shop()).rules
    expect(rules.filter(r => r.kind === 'entity')).toHaveLength(6)
    expect(rules.filter(r => r.kind === 'fk')).toHaveLength(4)
    expect(rules.find(r => r.kind === 'table')).toMatchObject({ association: 'CONTENIR', legs: 2, columns: ['id_commande', 'id_produit'] })
  })

  it('one-to-one, missing identifiers, lone associations, reflexive ones', () => {
    const m = shop()
    m.links.find(l => l.id === 'l1')!.card = '0,1'
    m.entities[5].attributes = m.entities[5].attributes.filter(a => !a.identifier)
    m.associations.push({ id: 'x', name: 'LIVRER', x: 0, y: 0, attributes: [] })
    m.entities.push({ id: 'em', name: 'EMPLOYE', x: 0, y: 0, attributes: [id('em1', 'id_employe')] })
    m.associations.push({ id: 'ch', name: 'DIRIGER', x: 0, y: 0, attributes: [] })
    m.links.push({ id: 'l11', entity: 'em', association: 'ch', card: '0,n' }, { id: 'l12', entity: 'em', association: 'ch', card: '0,1' })
    const mld = toMld(m)
    expect(mld.rules).toContainEqual(expect.objectContaining({ kind: 'oneToOne', association: 'PASSER', child: 'COMMANDE' }))
    expect(mld.rules).toContainEqual({ kind: 'noIdentifier', relation: 'AVIS', key: 'id_avis' })
    expect(mld.rules).toContainEqual({ kind: 'skipped', association: 'LIVRER' })
    expect(line(m, 'EMPLOYE')).toBe('_id_employe, #id_employe_diriger')
    const fk = mld.relations.find(r => r.name === 'EMPLOYE')!.columns[1]
    expect(fk).toMatchObject({ nullable: true, unique: false })
  })
})

describe('the MPD', () => {
  it('names tables and keys the SQL way, with types', () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'postgres', null, 'boutique.mcd.json')
    expect(mpd.tables.map(t => t.name)).toEqual(['client', 'adresse', 'commande', 'categorie', 'produit', 'avis', 'commande_produit'])
    const commande = mpd.tables.find(t => t.name === 'commande')!
    expect(commande.columns.map(c => c.name)).toEqual(['id', 'passee_le', 'statut', 'client_id'])
    expect(commande.columns[0]).toMatchObject({ pk: true, auto: true, type: 'int' })
    expect(commande.columns[2]).toMatchObject({ type: 'varchar', length: 255, nullable: true })
    expect(commande.columns[3]).toMatchObject({ type: 'int', ref: { table: 't-cl', column: 'c-cl1' } })
    expect(commande.columns[3].auto).toBeUndefined()
    const join = mpd.tables.find(t => t.name === 'commande_produit')!
    expect(join.columns.map(c => `${c.name}${c.pk ? '*' : ''}`)).toEqual(['commande_id*', 'produit_id*', 'quantite'])
    expect(mpd.source).toBe('boutique.mcd.json')
    expect(mpd.sourceHash).toBe(mcdHash(shop(), DEFAULT_NAMING))
    expect(checkMpd(mpd)).toEqual([])
  })

  it('follows the naming chosen', () => {
    const mpd = generateMpd(shop(), { tables: 'pascal', pk: 'keep', fk: 'id_table', join: 'association' }, 'mysql')
    const commande = mpd.tables.find(t => t.name === 'Commande')!
    expect(commande.columns.map(c => c.name)).toEqual(['id_commande', 'passee_le', 'statut', 'id_client'])
    expect(mpd.tables.map(t => t.name)).toContain('Contenir')
    expect(generateMpd(shop(), { ...DEFAULT_NAMING, tables: 'upper' }, 'mysql').tables[0].name).toBe('CLIENT')
  })

  it('made again, keeps hand changes and places; follows the MCD for the rest', () => {
    const first = generateMpd(shop(), DEFAULT_NAMING, 'postgres')
    const produit = first.tables.find(t => t.name === 'produit')!
    produit.x = 1234
    const prix = produit.columns.find(c => c.name === 'prix')!
    Object.assign(prix, { length: 12, scale: 3, edited: true })
    produit.indexes.push({ id: 'i1', name: 'idx_libelle', columns: [produit.columns.find(c => c.name === 'libelle')!.id] })
    const m = shop()
    m.entities[4].attributes.push(attr('pr5', 'poids', 'decimal'))
    m.entities[4].attributes = m.entities[4].attributes.filter(a => a.id !== 'pr2')
    const again = generateMpd(m, DEFAULT_NAMING, 'postgres', first).tables.find(t => t.name === 'produit')!
    expect(again.x).toBe(1234)
    expect(again.columns.find(c => c.name === 'prix')).toMatchObject({ length: 12, scale: 3, edited: true })
    expect(again.columns.map(c => c.name)).toContain('poids')
    // The index on the column gone is gone too
    expect(again.indexes).toEqual([])
  })

  it('reads back what it wrote, and draws like the schema', () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'sqlite')
    expect(cleanMpd(JSON.parse(JSON.stringify(mpd)))).toEqual(mpd)
    expect(cleanMpd({ engine: 'oracle', tables: [{ columns: [{ type: 'blob' }] }] })).toMatchObject({ engine: 'postgres', tables: [{ columns: [{ type: 'varchar' }] }] })
    const { diagram, positions } = mpdDiagram(mpd)
    expect(diagram.tables).toHaveLength(7)
    expect(diagram.links).toHaveLength(6)
    expect(Object.keys(positions)).toContain('t-cl.client')
  })

  it('reports what the SQL would refuse', () => {
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'mysql')
    const client = mpd.tables[0]
    client.columns[2] = { ...client.columns[2], type: 'text', unique: true }
    client.columns[1].name = 'email'
    mpd.tables.find(t => t.name === 'commande')!.columns[3] = { ...mpd.tables.find(t => t.name === 'commande')!.columns[3], type: 'bigint', edited: true }
    const codes = checkMpd(mpd).map(i => `${i.code}:${i.name}`)
    expect(codes).toContain('uniqueText:client.email')
    expect(codes).toContain('sameColumn:client.email')
    expect(codes).toContain('fkType:commande.client_id')
  })
})

describe('the SQL', () => {
  it('writes each type for each engine', () => {
    expect(sqlType({ type: 'decimal', length: 10, scale: 2 }, 'postgres')).toBe('NUMERIC(10,2)')
    expect(sqlType({ type: 'decimal', length: 10, scale: 2 }, 'mysql')).toBe('DECIMAL(10,2)')
    expect(sqlType({ type: 'bool' }, 'mysql')).toBe('TINYINT(1)')
    expect(sqlType({ type: 'datetime' }, 'postgres')).toBe('TIMESTAMP')
    expect(sqlType({ type: 'varchar', length: 80 }, 'sqlite')).toBe('TEXT')
    expect(quoteName('user', 'postgres')).toBe('"user"')
    expect(quoteName('order', 'mysql')).toBe('`order`')
    expect(quoteName('commande', 'mysql')).toBe('commande')
  })

  it('puts the tables pointed at first, keys and the header', () => {
    const sql = mpdSql(generateMpd(shop(), DEFAULT_NAMING, 'mysql'), ['conception/boutique.sql'])
    expect(sql.startsWith('-- conception/boutique.sql\n')).toBe(true)
    expect(sql).toContain('  id INT AUTO_INCREMENT PRIMARY KEY,')
    expect(sql).toContain('  PRIMARY KEY (commande_id, produit_id)')
    expect(sql).toContain('  FOREIGN KEY (client_id) REFERENCES client (id)')
    expect(sql.indexOf('CREATE TABLE client')).toBeLessThan(sql.indexOf('CREATE TABLE commande '))
    expect(sql.indexOf('CREATE TABLE produit')).toBeLessThan(sql.indexOf('CREATE TABLE commande_produit'))
    const pg = mpdSql(generateMpd(shop(), DEFAULT_NAMING, 'postgres'))
    expect(pg).toContain('  id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,')
    expect(pg).toContain('  prix NUMERIC(10,2),')
  })

  it('a cycle of keys ends with ALTER TABLE', () => {
    const m = shop()
    // Each client has a favourite product (0,1), and each product a creator (1,1)
    m.associations.push({ id: 'pf', name: 'PREFERER', x: 0, y: 0, attributes: [] }, { id: 'cr', name: 'CREER', x: 0, y: 0, attributes: [] })
    m.links.push({ id: 'l20', entity: 'cl', association: 'pf', card: '0,1' }, { id: 'l21', entity: 'pr', association: 'pf', card: '0,n' })
    m.links.push({ id: 'l22', entity: 'pr', association: 'cr', card: '1,1' }, { id: 'l23', entity: 'cl', association: 'cr', card: '0,n' })
    const sql = mpdSql(generateMpd(m, DEFAULT_NAMING, 'postgres'))
    expect(sql).toMatch(/ALTER TABLE \w+ ADD FOREIGN KEY/)
  })

  it('runs in a real SQLite, and the keys hold', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    const m = shop()
    m.entities[0].name = 'USER'
    db.run('PRAGMA foreign_keys = ON')
    db.run(mpdSql(generateMpd(m, DEFAULT_NAMING, 'sqlite')))
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.flat()
    expect(tables).toEqual(['adresse', 'avis', 'categorie', 'commande', 'commande_produit', 'produit', 'user'])
    db.run(`INSERT INTO "user" (nom, email, inscrit_le) VALUES ('A', 'a@x', '2026-01-01')`)
    db.run(`INSERT INTO commande (passee_le, user_id) VALUES ('2026-01-02', 1)`)
    expect(() => db.run(`INSERT INTO commande (passee_le, user_id) VALUES ('2026-01-02', 99)`)).toThrow(/FOREIGN KEY/)
    db.close()
  })
})

describe('the MPD and its SQL, in the project', () => {
  it('saved next to the MCD, listed with its SQL; renamed together', () => {
    const project = tempDir('shop')
    saveProjects([{ name: 'shop', path: project }])
    const mcdFile = createModel(project, 'mcd', 'Boutique')
    saveModel(project, mcdFile, { v: 1, kind: 'mcd', name: 'Boutique', updatedAt: '', mcd: shop(), naming: { ...DEFAULT_NAMING, tables: 'upper' } })
    expect(readModel(project, mcdFile).naming?.tables).toBe('upper')
    const mpd = generateMpd(shop(), DEFAULT_NAMING, 'mysql', null, mcdFile)
    saveModel(project, 'boutique.mpd.json', { v: 1, kind: 'mpd', name: 'Boutique', updatedAt: '', mpd })
    expect(readModel(project, 'boutique.mpd.json').mpd).toEqual(mpd)

    const path = writeSql(project, 'boutique.mpd.json', mpdSql(mpd))
    expect(path).toBe(join(project, 'conception', 'boutique.sql'))
    expect(readFileSync(path, 'utf-8')).toContain('CREATE TABLE commande_produit')
    expect(() => writeSql(project, mcdFile, 'x')).toThrow(/Only an MPD/)
    const listed = listModels(project).find(x => x.kind === 'mpd')!
    expect(listed.sqlAt).toBeTruthy()
    expect(listed.mpd?.tables).toHaveLength(7)

    // The MCD renamed: its MPD and its SQL follow
    expect(renameModel(project, mcdFile, 'Magasin')).toBe('magasin.mcd.json')
    expect(listModels(project).map(x => x.file).sort()).toEqual(['magasin.mcd.json', 'magasin.mpd.json'])
    expect(readModel(project, 'magasin.mpd.json')).toMatchObject({ name: 'Magasin', mpd: { source: 'magasin.mcd.json' } })
    expect(existsSync(join(project, 'conception', 'magasin.sql'))).toBe(true)
  })

  it("the engine read from the project's files", () => {
    const project = tempDir('shop')
    saveProjects([{ name: 'shop', path: project }])
    expect(projectEngine(project)).toBe('postgres')
    writeFileSync(join(project, 'compose.yaml'), 'services:\n  db:\n    image: mariadb:11\n')
    expect(projectEngine(project)).toBe('mysql')
    writeFileSync(join(project, '.env'), 'DATABASE_URL="postgresql://app:x@127.0.0.1:5432/app"\n')
    expect(projectEngine(project)).toBe('postgres')
    writeFileSync(join(project, '.env.local'), 'DATABASE_URL=sqlite:///%kernel.project_dir%/var/data.db\n')
    expect(projectEngine(project)).toBe('sqlite')
  })
})
