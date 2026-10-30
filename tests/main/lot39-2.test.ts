import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { McdModel } from '@shared/types'
import { associationBox, checkMcd, cleanMcd, cleanModelFile, entityBox, legLine, mcdSvg, modelFileName, MODEL_FILE_RE, nextCard, noteBox, wrap } from '@shared/lib/mcd'
import { createModel, listModels, readModel, removeModel, renameModel, saveModel } from '../../src/main/services/modeling/models'
import { saveProjects, tempDir } from '../helpers'

/** v3.9 lot 2: the Modeling page and the MCD editor */

const shop = (): McdModel => ({
  entities: [
    { id: 'c', name: 'CLIENT', x: 0, y: 0, attributes: [{ id: 'c1', name: 'id_client', type: 'int', identifier: true }, { id: 'c2', name: 'email', type: 'varchar', length: 180 }] },
    { id: 'o', name: 'COMMANDE', x: 0, y: 300, attributes: [{ id: 'o1', name: 'id_commande', type: 'int', identifier: true }, { id: 'o2', name: 'passee_le', type: 'datetime' }] }
  ],
  associations: [{ id: 'p', name: 'PASSER', x: 20, y: 160, attributes: [] }],
  links: [{ id: 'l1', entity: 'c', association: 'p', card: '0,n' }, { id: 'l2', entity: 'o', association: 'p', card: '1,1' }],
  notes: [{ id: 'n', x: 300, y: 0, text: 'Un client sans commande ? à voir avec le client.' }]
})

describe('the MCD', () => {
  it('a sound model has nothing to report', () => {
    expect(checkMcd(shop())).toEqual([])
  })

  it('reports what would stop the MLD, and what is worth a look', () => {
    const m = shop()
    m.entities[0].attributes[0].identifier = false
    m.entities[1].name = 'client'
    m.entities[1].attributes[1].type = ''
    m.associations.push({ id: 'x', name: 'LIVRER', x: 0, y: 0, attributes: [] })
    m.entities.push({ id: 'z', name: 'PRODUIT', x: 0, y: 0, attributes: [{ id: 'z1', name: 'id', type: 'int', identifier: true }] })
    const codes = checkMcd(m).map(i => `${i.level}:${i.code}:${i.name}`)
    expect(codes).toContain('error:noIdentifier:CLIENT')
    expect(codes).toContain('error:sameName:client')
    expect(codes).toContain('warning:noType:client.passee_le')
    expect(codes).toContain('warning:lonelyAssociation:LIVRER')
    expect(codes).toContain('warning:lonelyEntity:PRODUIT')
  })

  it('a click on a leg cycles its cardinality', () => {
    expect(['0,1', '1,1', '0,n', '1,n'].map(c => nextCard(c as '0,1'))).toEqual(['1,1', '0,n', '1,n', '0,1'])
  })

  it('boxes grow with their text, and a leg leaves the entity at its edge', () => {
    const [c] = shop().entities
    expect(entityBox(c)).toMatchObject({ x: 0, y: 0, h: 30 + 2 * 20 + 10 })
    expect(entityBox({ ...c, name: 'UNE_TRES_LONGUE_ENTITE_DE_TEST' }).w).toBeGreaterThan(entityBox(c).w)
    const a = associationBox(shop().associations[0])
    const leg = legLine({ x: 0, y: 0, w: 150, h: 70 }, { x: 15, y: 200, w: 120, h: 44 })
    expect(leg.from).toEqual({ x: 75, y: 70 })
    expect(leg.to).toEqual({ x: 75, y: 200 })
    expect(a.w).toBeGreaterThanOrEqual(116)
    expect(noteBox({ id: 'n', x: 0, y: 0, text: 'a b' }).h).toBe(35)
    expect(wrap('un deux trois quatre', 9)).toEqual(['un deux', 'trois', 'quatre'])
  })

  it('draws as SVG, names upper-cased, identifiers underlined, cardinalities written', () => {
    const svg = mcdSvg(shop(), { canvas: '#000', card: '#111', line: '#888', entity: '#c0f', text: '#fff', muted: '#aaa', card11: '#c0f', note: '#ff0', noteText: '#000' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('>CLIENT<')
    expect(svg).toContain('text-decoration="underline">id_client<')
    expect(svg).toContain('>0,n<')
    expect(svg).toContain('>1,1<')
    expect(mcdSvg({ ...shop(), entities: [{ ...shop().entities[0], name: '<b>' }] }, { canvas: '', card: '', line: '', entity: '', text: '', muted: '', card11: '', note: '', noteText: '' })).toContain('&lt;B&gt;')
  })

  it('a file read back keeps its shape: bad values cleaned, legs to nothing dropped', () => {
    const m = cleanMcd({ entities: [{ id: 'a', name: 'A', x: 1.6, y: 'x', attributes: [{ name: 'id', type: 'nope', identifier: 1 }] }], associations: [], links: [{ entity: 'a', association: 'ghost', card: '9,9' }], notes: 'no' })
    expect(m.entities[0]).toMatchObject({ x: 2, y: 0, attributes: [{ name: 'id', type: '', identifier: true }] })
    expect(m.links).toEqual([])
    expect(m.notes).toEqual([])
    expect(cleanModelFile({ kind: 'weird' }).kind).toBe('mcd')
  })

  it('file names: from the model name, only what DevForge gives', () => {
    expect(modelFileName('Boutique en ligne', 'mcd')).toBe('boutique-en-ligne.mcd.json')
    expect(modelFileName('Écoles & élèves !', 'mcd')).toBe('ecoles-eleves.mcd.json')
    expect(modelFileName('***', 'mcd')).toBe('modele.mcd.json')
    for (const bad of ['../x.mcd.json', 'a/b.mcd.json', 'x.mcd.txt', 'X.mcd.json', 'x.exe.json']) expect(MODEL_FILE_RE.test(bad)).toBe(false)
  })
})

describe("a project's models, in its conception/ folder", () => {
  it('created, saved, listed, renamed and removed', () => {
    const project = tempDir('shop')
    saveProjects([{ name: 'shop', path: project }])
    expect(listModels(project)).toEqual([])

    const file = createModel(project, 'mcd', 'Boutique')
    expect(file).toBe('boutique.mcd.json')
    expect(createModel(project, 'mcd', 'Boutique')).toBe('boutique-2.mcd.json')
    expect(readModel(project, file)).toMatchObject({ v: 1, kind: 'mcd', name: 'Boutique', mcd: { entities: [] } })

    saveModel(project, file, { v: 1, kind: 'mcd', name: 'Boutique', updatedAt: '', mcd: shop() })
    const onDisk = JSON.parse(readFileSync(join(project, 'conception', file), 'utf-8'))
    expect(onDisk.mcd.entities.map((e: { name: string }) => e.name)).toEqual(['CLIENT', 'COMMANDE'])
    expect(existsSync(join(project, 'conception', `${file}.tmp`))).toBe(false)
    expect(readModel(project, file).mcd).toEqual(shop())

    // A broken or foreign file is left out of the list
    writeFileSync(join(project, 'conception', 'broken.mcd.json'), '{')
    writeFileSync(join(project, 'conception', 'notes.txt'), 'x')
    expect(listModels(project).map(m => m.file).sort()).toEqual(['boutique-2.mcd.json', 'boutique.mcd.json'])

    const renamed = renameModel(project, file, 'Boutique en ligne')
    expect(renamed).toBe('boutique-en-ligne.mcd.json')
    expect(existsSync(join(project, 'conception', file))).toBe(false)
    expect(readModel(project, renamed).name).toBe('Boutique en ligne')

    removeModel(project, renamed)
    expect(listModels(project).map(m => m.file)).toEqual(['boutique-2.mcd.json'])
  })

  it('never outside a saved project, never another kind or name', () => {
    const project = tempDir('shop')
    const other = tempDir('other')
    saveProjects([{ name: 'shop', path: project }])
    expect(() => listModels(other)).toThrow(/Unknown project/)
    expect(() => readModel(project, '../../projects.json')).toThrow(/Invalid/)
    const file = createModel(project, 'mcd', 'x')
    expect(() => saveModel(project, file, { v: 1, kind: 'usecase', name: 'x', updatedAt: '' })).toThrow(/kind/)
    expect(() => createModel(project, 'virus' as 'mcd', 'x')).toThrow(/kind/)
  })
})
