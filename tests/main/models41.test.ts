import { existsSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ModelProgress } from '@shared/types'
import { closeAllDbs, dbQuery } from '../../src/main/services/database/dbClient'
import { saveDbConnection } from '../../src/main/services/database/dbStorage'
import { modelFromDatabase } from '../../src/main/services/modeling/fromDatabase'
import { createModel, listModels, readModel } from '../../src/main/services/modeling/models'
import { linkResource } from '../../src/main/services/projects/projectHub'
import { planAction } from '../../src/main/services/assistant/assistantActions'
import { runTool } from '../../src/main/services/assistant/assistantTools'
import { undoModels } from '../../src/main/services/assistant/modelingTools'
import { saveProjects, tempDir } from '../helpers'

/** v4.1: a project's MCD and MPD made from its database, and Forgy making models */

const project = tempDir('shop')
const empty = tempDir('blank')
const drawn = tempDir('drawn')
const conception = (dir = project) => existsSync(join(dir, 'conception')) ? readdirSync(join(dir, 'conception')).sort() : []

beforeAll(async () => {
  saveProjects([{ name: 'shop', path: project }, { name: 'blank', path: empty }, { name: 'drawn', path: drawn }])
  const file = join(tempDir('db'), 'shop.sqlite')
  writeFileSync(file, Buffer.alloc(0))
  saveDbConnection({ id: 'lite', name: 'Shop SQLite', type: 'sqlite', file, color: '' })
  for (const sql of [
    'CREATE TABLE client (id INTEGER PRIMARY KEY, email TEXT NOT NULL)',
    'CREATE TABLE commande (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES client(id), passee_le TEXT)',
    'CREATE TABLE produit (id INTEGER PRIMARY KEY, libelle TEXT)',
    'CREATE TABLE commande_produit (commande_id INTEGER REFERENCES commande(id), produit_id INTEGER REFERENCES produit(id), quantite INTEGER, PRIMARY KEY (commande_id, produit_id))'
  ]) expect((await dbQuery('lite', sql)).error).toBeUndefined()
  const blank = join(tempDir('db'), 'blank.sqlite')
  writeFileSync(blank, Buffer.alloc(0))
  saveDbConnection({ id: 'none', name: 'Empty', type: 'sqlite', file: blank, color: '' })
  await linkResource('p0', 'databases', 'lite', true)
})
afterAll(() => closeAllDbs())

describe('from the database', () => {
  it('makes the MCD and the linked MPD, reporting each step in order', async () => {
    const seen: ModelProgress[] = []
    const r = await modelFromDatabase(project, 'lite', 'Boutique', p => seen.push(p))
    expect(r).toEqual({ mcd: 'boutique.mcd.json', mpd: 'boutique.mpd.json', tables: 4 })
    expect(seen.map(p => p.step)).toEqual(['connect', 'read', 'mcd', 'mpd', 'write', 'done'])
    expect(seen.map(p => p.index)).toEqual([0, 1, 2, 3, 4, 5])
    expect(seen[0].detail).toBe('Shop SQLite')
    expect(seen[1].detail).toBe('4')

    const mcd = readModel(project, r.mcd).mcd!
    expect(mcd.entities.map(e => e.name).sort()).toEqual(['CLIENT', 'COMMANDE', 'PRODUIT'])
    // The link table is an association again, its column with it
    expect(mcd.associations.find(a => a.name === 'COMMANDE_PRODUIT')!.attributes.map(a => a.name)).toEqual(['quantite'])
    const mpd = readModel(project, r.mpd).mpd!
    expect(mpd.connection).toBe('lite')
    expect(mpd.tables.map(t => t.name).sort()).toEqual(['client', 'commande', 'commande_produit', 'produit'])
  })

  it('takes a free name rather than writing over the models there', async () => {
    const r = await modelFromDatabase(project, 'lite', 'Boutique')
    expect(r.mcd).toBe('boutique-2.mcd.json')
    expect(listModels(project).filter(m => m.name === 'Boutique')).toHaveLength(4)
  })

  it('leaves nothing behind when it cannot finish', async () => {
    const before = conception(empty)
    await expect(modelFromDatabase(empty, 'none', 'Rien')).rejects.toThrow(/no table yet/)
    await expect(modelFromDatabase(empty, 'nope', 'Rien')).rejects.toThrow(/Unknown connection/)
    await expect(modelFromDatabase(tempDir('stranger'), 'lite', 'Rien')).rejects.toThrow(/Unknown project/)
    expect(conception(empty)).toEqual(before)
  })
})

describe('an MPD by hand', () => {
  it('starts empty, on the engine the project\'s files name, without any database', () => {
    writeFileSync(join(drawn, '.env'), 'DATABASE_URL=mysql://app:secret@127.0.0.1:3306/shop\n')
    const file = createModel(drawn, 'mpd', 'Schéma')
    expect(file).toBe('schema.mpd.json')
    expect(readModel(drawn, file)).toMatchObject({ kind: 'mpd', name: 'Schéma', mpd: { engine: 'mysql', tables: [] } })
    expect(readModel(drawn, file).mpd!.connection).toBeUndefined()
  })
})

describe('Forgy', () => {
  it('lists the linked database with the models, so it knows it can read it', async () => {
    expect(await runTool('project_models', { project: 'shop' })).toMatch(/Linked database\(s\): "Shop SQLite" \(sqlite\)/)
    expect(await runTool('project_models', { project: 'blank' })).toMatch(/No database linked/)
  })

  it('creates the MCD from the project\'s linked database after the click, and undoes it', async () => {
    const plan = await planAction('create_model', { project: 'shop', source: 'database', name: 'Depuis Forgy' })
    expect(plan).toMatchObject({ reversible: true, safe: false })
    expect(plan.preview).toMatch(/Shop SQLite/)
    expect(conception().some(f => f.startsWith('depuis-forgy'))).toBe(false)
    const { output, undo } = await plan.run()
    expect(output).toMatch(/4 tables read: conception\/depuis-forgy\.mcd\.json and conception\/depuis-forgy\.mpd\.json/)
    expect(conception()).toEqual(expect.arrayContaining(['depuis-forgy.mcd.json', 'depuis-forgy.mpd.json']))
    expect(undoModels(undo as never)).toMatch(/Removed/)
    expect(conception().some(f => f.startsWith('depuis-forgy'))).toBe(false)
  })

  it('needs a connection when the project has none linked', async () => {
    await expect(planAction('create_model', { project: 'blank', source: 'database' })).rejects.toThrow(/no linked database/)
    const plan = await planAction('create_model', { project: 'blank', source: 'database', connection: 'shop sqlite' })
    expect(plan.preview).toMatch(/Shop SQLite/)
  })

  it('draws an MCD from a description, shown before it is written', async () => {
    const plan = await planAction('create_model', {
      project: 'blank', source: 'description', name: 'Bibliothèque',
      entities: [{ name: 'LIVRE', attributes: [{ name: 'titre', type: 'varchar' }] }, { name: 'AUTEUR', attributes: [{ name: 'nom', type: 'varchar' }] }],
      associations: [{ name: 'ECRIRE', legs: [{ entity: 'AUTEUR', card: '1,n' }, { entity: 'LIVRE', card: '1,n' }] }]
    })
    expect(plan.preview).toContain('■ LIVRE (#id_livre: int, titre: varchar)')
    expect(plan.preview).toContain('◇ ECRIRE: AUTEUR 1,n — LIVRE 1,n')
    expect(conception(empty)).toEqual([])
    const { output } = await plan.run()
    expect(output).toBe('conception/bibliotheque.mcd.json: 2 entities, 1 associations')
    expect(readModel(empty, 'bibliotheque.mcd.json')).toMatchObject({ kind: 'mcd', name: 'Bibliothèque' })
  })

  it('sends a wrong description back to the model with what to fix', async () => {
    await expect(planAction('create_model', { project: 'blank', source: 'description', entities: [{ name: 'A' }], associations: [{ name: 'X', legs: [{ entity: 'A', card: '1,1' }, { entity: 'Z', card: '0,n' }] }] }))
      .rejects.toThrow(/unknown entity "Z"/)
    await expect(planAction('create_model', { project: 'blank', source: 'magic' })).rejects.toThrow(/"source" must be/)
  })
})
