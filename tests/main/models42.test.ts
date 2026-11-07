import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { BrowserWindow } from 'electron'
import { mcdFromMpdFile, removeModels } from '../../src/main/services/modeling/fromDatabase'
import { createModel, readModel, saveModel, writeSql } from '../../src/main/services/modeling/models'
import { saveProject } from '../../src/main/services/projects/projectStorage'
import { removeDbConnection, saveDbConnection } from '../../src/main/services/database/dbStorage'
import { planAction } from '../../src/main/services/assistant/assistantActions'
import { undoModels } from '../../src/main/services/assistant/modelingTools'
import { saveProjects, tempDir } from '../helpers'

/** v4.2 lot 3: Forgy draws MPDs and diagrams; an MPD drawn by hand gets its MCD; the windows hear of each model written */

const samePath = (a: string, b: string) => resolve(a).toLowerCase() === resolve(b).toLowerCase()

const project = tempDir('forgy42')
const conception = () => existsSync(join(project, 'conception')) ? readdirSync(join(project, 'conception')).sort() : []

beforeAll(() => {
  saveProjects([{ name: 'atelier', path: project }])
  // Its engine, from the .env
  writeFileSync(join(project, '.env'), 'DATABASE_URL=mysql://app:pw@127.0.0.1:3306/atelier\n')
})

describe('Forgy draws', () => {
  it('an MPD from its tables, on the project’s engine, shown before it is written, undone after', async () => {
    const plan = await planAction('create_model', {
      project: 'atelier', kind: 'mpd', source: 'description', name: 'Blog',
      tables: [{ name: 'auteur', columns: [{ name: 'nom', type: 'varchar' }] }, { name: 'article', columns: [{ name: 'titre', type: 'string' }, { name: 'auteur_id', references: 'auteur' }] }]
    })
    expect(plan).toMatchObject({ title: 'Create an MPD · atelier', reversible: true, safe: false })
    expect(plan.preview).toContain('for mysql')
    expect(plan.preview).toMatch(/▦ article \(#id INT, titre VARCHAR\(255\), auteur_id INT → auteur\)/i)
    expect(conception()).toEqual([])
    const { output, undo } = await plan.run()
    expect(output).toBe('conception/blog.mpd.json: 2 tables')
    const m = readModel(project, 'blog.mpd.json')
    expect(m.mpd?.engine).toBe('mysql')
    expect(m.mpd?.tables.map(t => t.name)).toEqual(['auteur', 'article'])
    expect(undoModels(undo as never)).toMatch(/Removed conception\/blog\.mpd\.json/)
    expect(conception()).toEqual([])
  })

  it('a sequence diagram from its participants and messages, in order', async () => {
    const plan = await planAction('create_model', {
      project: 'atelier', kind: 'sequence', source: 'description', name: 'Commande',
      nodes: [{ name: 'Client', type: 'actor' }, { name: 'API' }],
      links: [{ from: 'Client', to: 'API', label: 'POST /commande' }, { from: 'API', to: 'Client', type: 'return', label: '201' }]
    })
    expect(plan.title).toBe('Create a sequence diagram · atelier')
    expect(plan.preview).toContain('→ message: Client → API "POST /commande"')
    const { output } = await plan.run()
    expect(output).toBe('conception/commande.sequence.json: 2 parts, 2 links')
    const d = readModel(project, 'commande.sequence.json').diagram!
    expect(d.edges.map(e => e.label)).toEqual(['POST /commande', '201'])
    expect(d.edges[1].y!).toBeGreaterThan(d.edges[0].y!)
  })

  it('tells the model what is wrong: an unknown kind, a diagram from a database, a part of another kind', async () => {
    await expect(planAction('create_model', { project: 'atelier', kind: 'gantt', source: 'description' })).rejects.toThrow(/"kind" must be/)
    await expect(planAction('create_model', { project: 'atelier', kind: 'flow', source: 'database' })).rejects.toThrow(/drawn from a description/)
    await expect(planAction('create_model', { project: 'atelier', kind: 'flow', source: 'description', nodes: [{ name: 'A', type: 'service' }] })).rejects.toThrow(/not a part of a flow diagram/)
    await expect(planAction('create_model', { project: 'atelier', kind: 'mpd', source: 'description', tables: [{ name: 'a', columns: [{ name: 'x', type: 'blob' }] }] })).rejects.toThrow(/Unknown type "blob"/)
  })
})

describe('the windows hear of each model written or removed', () => {
  it('created, saved, its SQL written, removed: the project named each time', () => {
    const heard: { topic: string; scope?: string }[] = []
    const win = { isDestroyed: () => false, webContents: { send: (channel: string, e: { topic: string; scope?: string }) => { if (channel === 'data:changed') heard.push(e) } } }
    const spy = vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([win] as never)
    try {
      const file = createModel(project, 'flow', 'Paiement')
      saveModel(project, file, { ...readModel(project, file), name: 'Paiement' })
      writeSql(project, 'boutique.mpd.json', 'SELECT 1;')
      removeModels(project, [file])
      expect(heard.map(e => e.topic)).toEqual(['models', 'models', 'models', 'models'])
      for (const e of heard) expect(samePath(e.scope!, project)).toBe(true)
    } finally { spy.mockRestore() }
  })

  it('and of the projects and connections saved, so every list of them follows', () => {
    const heard: { topic: string; scope?: string }[] = []
    const win = { isDestroyed: () => false, webContents: { send: (channel: string, e: { topic: string }) => { if (channel === 'data:changed') heard.push(e) } } }
    const spy = vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([win] as never)
    try {
      saveProject({ id: 'p9', name: 'Neuf', path: tempDir('neuf'), framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null })
      saveDbConnection({ id: 'c9', name: 'Locale', type: 'sqlite', file: join(tempDir('db9'), 'x.sqlite'), color: '' })
      removeDbConnection('c9')
      expect(heard).toEqual([{ topic: 'projects' }, { topic: 'db-connections' }, { topic: 'db-connections' }])
    } finally { spy.mockRestore() }
  })
})

describe('the MCD of an MPD drawn by hand', () => {
  it('is written next to it, the MPD tied to it; never over an MCD already there', () => {
    const dir = join(project, 'conception')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'boutique.mpd.json'), JSON.stringify({ v: 1, kind: 'mpd', name: 'Boutique', updatedAt: '2026-11-01T00:00:00.000Z', mpd: {
      engine: 'mysql', tables: [
        { id: 'tC', name: 'client', x: 40, y: 40, indexes: [], columns: [{ id: 'c1', name: 'id', type: 'int', pk: true, auto: true }] },
        { id: 'tO', name: 'commande', x: 400, y: 40, indexes: [], columns: [{ id: 'o1', name: 'id', type: 'int', pk: true, auto: true }, { id: 'o2', name: 'client_id', type: 'int', ref: { table: 'tC', column: 'c1' } }] }
      ] } }))
    expect(mcdFromMpdFile(project, 'boutique.mpd.json')).toEqual({ mcd: 'boutique.mcd.json', entities: 2, associations: 1 })
    const mcd = readModel(project, 'boutique.mcd.json')
    expect(mcd).toMatchObject({ kind: 'mcd', name: 'Boutique' })
    expect(mcd.mcd?.associations[0].name).toBe('COMMANDE_CLIENT')
    const mpd = readModel(project, 'boutique.mpd.json').mpd!
    expect(mpd.source).toBe('boutique.mcd.json')
    expect(mpd.tables.find(t => t.name === 'commande')).toMatchObject({ x: 400, y: 40 })
    expect(() => mcdFromMpdFile(project, 'boutique.mpd.json')).toThrow(/already exists/)
    expect(() => mcdFromMpdFile(project, 'commande.sequence.json')).toThrow(/Not an MPD/)
  })
})
