import { describe, expect, it } from 'vitest'
import type { DiagramModel, MpdModel } from '@shared/types'
import { McdSpecError } from '@shared/lib/mcdSpec'
import { mpdFromSpec } from '@shared/lib/mpdSpec'
import { diagramFromSpec } from '@shared/lib/diagramSpec'
import { mcdFromMpd } from '@shared/lib/mpdDb'
import { DEFAULT_NAMING, mcdHash } from '@shared/lib/mpd'
import { nodeBox } from '@shared/lib/uml'
import type { Box } from '@shared/lib/mcd'

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** v4.2 lot 3: an MPD and the diagrams from a description (Forgy); the MCD of an MPD drawn by hand */

const named = (d: DiagramModel, name: string) => d.nodes.find(n => n.name === name)!

describe('mpdFromSpec', () => {
  const blog = () => mpdFromSpec({ tables: [
    { name: 'auteur', columns: [{ name: 'nom', type: 'string', length: 80, nullable: false }] },
    { name: 'article', columns: [{ name: 'id', type: 'bigint', pk: true }, { name: 'titre', type: 'varchar' }, { name: 'auteur_id', references: 'auteur', nullable: false }, { name: 'slug', type: 'varchar', unique: true }] }
  ] }, 'postgres')

  it('gives each table a key, a foreign key the type of the key it points at, and lays them out apart', () => {
    const m = blog()
    const [auteur, article] = m.tables
    expect(m.engine).toBe('postgres')
    expect(auteur.columns[0]).toMatchObject({ name: 'id', type: 'int', pk: true, auto: true })
    expect(auteur.columns[1]).toMatchObject({ name: 'nom', type: 'varchar', length: 80 })
    expect(auteur.columns[1].nullable).toBeUndefined()
    expect(article.columns[0]).toMatchObject({ name: 'id', type: 'bigint', pk: true })
    expect(article.columns.find(c => c.name === 'auteur_id')).toMatchObject({ type: 'int', ref: { table: auteur.id, column: auteur.columns[0].id } })
    expect(article.columns.find(c => c.name === 'titre')).toMatchObject({ length: 255, nullable: true })
    expect(article.columns.find(c => c.name === 'slug')?.unique).toBe(true)
    expect(auteur.x !== article.x || auteur.y !== article.y).toBe(true)
  })

  it('sends back what to fix', () => {
    expect(() => mpdFromSpec({ tables: [] }, 'mysql')).toThrow(McdSpecError)
    expect(() => mpdFromSpec({ tables: [{ name: 'a' }, { name: 'A' }] }, 'mysql')).toThrow(/Two tables are named A/)
    expect(() => mpdFromSpec({ tables: [{ name: 'a', columns: [{ name: 'x', type: 'blob' }] }] }, 'mysql')).toThrow(/Unknown type "blob"/)
    expect(() => mpdFromSpec({ tables: [{ name: 'a', columns: [{ name: 'b_id', references: 'b' }] }] }, 'mysql')).toThrow(/unknown table "b"/)
    expect(() => mpdFromSpec({ tables: [{ name: 'b' }, { name: 'a', columns: [{ name: 'b_x', references: 'b.x' }] }] }, 'mysql')).toThrow(/b has no column "x"/)
  })
})

describe('diagramFromSpec', () => {
  it('a sequence: its participants in a row, its messages one below the other in the order given', () => {
    const d = diagramFromSpec('sequence', {
      nodes: [{ name: 'Client', type: 'actor' }, { name: 'API' }, { name: 'Base' }],
      links: [{ from: 'Client', to: 'API', label: 'POST /commande' }, { from: 'API', to: 'Base', label: 'INSERT' }, { from: 'API', to: 'Client', type: 'return' }]
    })
    expect(d.nodes.map(n => n.type)).toEqual(['actor', 'participant', 'participant'])
    expect(new Set(d.nodes.map(n => n.y))).toEqual(new Set([0]))
    expect(named(d, 'API').x).toBeGreaterThan(named(d, 'Client').x)
    const ys = d.edges.map(e => e.y!)
    expect(ys[0]).toBeGreaterThan(96)
    expect(ys[1]).toBeGreaterThan(ys[0])
    expect(ys[2]).toBeGreaterThan(ys[1])
    expect(d.edges[2].type).toBe('return')
  })

  it('use cases: the actors on the left, the cases inside the system, drawn behind them', () => {
    const d = diagramFromSpec('usecase', {
      nodes: [{ name: 'Boutique', type: 'system' }, { name: 'Client', type: 'actor' }, { name: 'Commander', steps: ['Choisir', 'Payer'] }, { name: 'Payer' }],
      links: [{ from: 'Client', to: 'Commander' }, { from: 'Commander', to: 'Payer', type: 'include' }]
    })
    expect(d.nodes[0].type).toBe('system')
    const system = nodeBox(named(d, 'Boutique'))
    for (const name of ['Commander', 'Payer']) {
      const b = nodeBox(named(d, name))
      expect(b.x >= system.x && b.y >= system.y && b.x + b.w <= system.x + system.w && b.y + b.h <= system.y + system.h).toBe(true)
    }
    expect(nodeBox(named(d, 'Client')).x + nodeBox(named(d, 'Client')).w).toBeLessThan(system.x)
    expect(named(d, 'Commander').steps).toEqual(['Choisir', 'Payer'])
  })

  it('a flowchart from the top down, a loop back not stretching it; nothing on anything', () => {
    const d = diagramFromSpec('flow', {
      nodes: [{ name: 'Début', type: 'start' }, { name: 'Saisir' }, { name: 'Valide ?', type: 'decision' }, { name: 'Enregistrer' }, { name: 'Fin', type: 'end' }],
      links: [{ from: 'Début', to: 'Saisir' }, { from: 'Saisir', to: 'Valide ?' }, { from: 'Valide ?', to: 'Enregistrer', label: 'oui' }, { from: 'Valide ?', to: 'Saisir', label: 'non' }, { from: 'Enregistrer', to: 'Fin' }]
    })
    const ys = ['Début', 'Saisir', 'Valide ?', 'Enregistrer', 'Fin'].map(n => named(d, n).y)
    expect([...ys].sort((a, b) => a - b)).toEqual(ys)
    expect(new Set(ys).size).toBe(5)
    const boxes = d.nodes.map(nodeBox)
    expect(boxes.some((a, i) => boxes.some((b, j) => i < j && overlaps(a, b)))).toBe(false)
  })

  it('classes under the class they extend; an architecture from left to right', () => {
    const c = diagramFromSpec('class', {
      nodes: [{ name: 'Animal', attributes: ['- nom: string'], methods: ['+ crier(): void'] }, { name: 'Chien' }, { name: 'Chat' }],
      links: [{ from: 'Chien', to: 'Animal', type: 'inheritance' }, { from: 'Chat', to: 'Animal', type: 'inheritance' }]
    })
    expect(named(c, 'Chien').y).toBeGreaterThan(named(c, 'Animal').y)
    expect(named(c, 'Chien').y).toBe(named(c, 'Chat').y)
    expect(named(c, 'Animal').methods).toEqual(['+ crier(): void'])
    const a = diagramFromSpec('architecture', {
      nodes: [{ name: 'Navigateur', type: 'client' }, { name: 'API' }, { name: 'PostgreSQL', type: 'database' }],
      links: [{ from: 'Navigateur', to: 'API' }, { from: 'API', to: 'PostgreSQL' }]
    })
    expect(named(a, 'API').x).toBeGreaterThan(named(a, 'Navigateur').x)
    expect(named(a, 'PostgreSQL').x).toBeGreaterThan(named(a, 'API').x)
  })

  it('sends back what to fix, naming what the kind allows', () => {
    expect(() => diagramFromSpec('flow', { nodes: [{ name: 'A', type: 'actor' }] })).toThrow(/use start, step, decision, io, end/)
    expect(() => diagramFromSpec('flow', { nodes: [{ name: 'A' }], links: [{ from: 'A', to: 'B' }] })).toThrow(/unknown part: "B"/)
    expect(() => diagramFromSpec('class', { nodes: [{ name: 'A' }, { name: 'B' }], links: [{ from: 'A', to: 'B', type: 'message' }] })).toThrow(/not a link of a class diagram/)
    expect(() => diagramFromSpec('usecase', { nodes: [{ name: 'S', type: 'system' }, { name: 'C' }], links: [{ from: 'S', to: 'C' }] })).toThrow(/link its cases/)
  })
})

describe('mcdFromMpd', () => {
  /** An MPD drawn by hand: a link table, a foreign key that may be empty, a framework table, an index */
  const drawn = (): MpdModel => ({
    engine: 'postgres', naming: DEFAULT_NAMING, connection: 'db1',
    tables: [
      { id: 'tC', name: 'client', x: 40, y: 40, indexes: [], columns: [{ id: 'c1', name: 'id', type: 'int', pk: true, auto: true }, { id: 'c2', name: 'email', type: 'varchar', length: 120, unique: true }] },
      { id: 'tO', name: 'commande', x: 400, y: 40, columns: [{ id: 'o1', name: 'id', type: 'int', pk: true, auto: true }, { id: 'o2', name: 'client_id', type: 'int', nullable: true, ref: { table: 'tC', column: 'c1' } }],
        indexes: [{ id: 'i1', name: 'idx_commande_client', columns: ['o2'] }] },
      { id: 'tP', name: 'produit', x: 40, y: 400, indexes: [], columns: [{ id: 'p1', name: 'id', type: 'int', pk: true, auto: true }, { id: 'p2', name: 'libelle', type: 'text' }] },
      { id: 'tL', name: 'commande_produit', x: 400, y: 400, indexes: [], columns: [
        { id: 'l1', name: 'commande_id', type: 'int', pk: true, ref: { table: 'tO', column: 'o1' } },
        { id: 'l2', name: 'produit_id', type: 'int', pk: true, ref: { table: 'tP', column: 'p1' } },
        { id: 'l3', name: 'quantite', type: 'int' }] },
      { id: 'tM', name: 'migrations', x: 800, y: 40, indexes: [], columns: [{ id: 'm1', name: 'id', type: 'int', pk: true }] }
    ]
  })

  it('reads the link table as an association, a foreign key as a leg (0,1 when it may be empty)', () => {
    const { mcd } = mcdFromMpd(drawn(), 'shop.mcd.json')
    expect(mcd.entities.map(e => e.name).sort()).toEqual(['CLIENT', 'COMMANDE', 'PRODUIT'])
    const join = mcd.associations.find(a => a.name === 'COMMANDE_PRODUIT')!
    expect(join.attributes.map(a => a.name)).toEqual(['quantite'])
    expect(mcd.links.filter(l => l.association === join.id).map(l => l.card)).toEqual(['0,n', '0,n'])
    const fk = mcd.associations.find(a => a.name !== 'COMMANDE_PRODUIT')!
    const commande = mcd.entities.find(e => e.name === 'COMMANDE')!
    expect(mcd.links.find(l => l.association === fk.id && l.entity === commande.id)?.card).toBe('0,1')
  })

  it('ties the MPD to its MCD, keeping its places, index, unique column, connection and the tables the MCD leaves out', () => {
    const { mcd, naming, mpd } = mcdFromMpd(drawn(), 'shop.mcd.json')
    expect(mpd.source).toBe('shop.mcd.json')
    expect(mpd.sourceHash).toBe(mcdHash(mcd, naming))
    expect(mpd.connection).toBe('db1')
    const t = (name: string) => mpd.tables.find(x => x.name === name)!
    expect([t('commande').x, t('commande').y]).toEqual([400, 40])
    expect(t('client').columns.find(c => c.name === 'email')).toMatchObject({ unique: true, length: 120 })
    const fk = t('commande').columns.find(c => c.name === 'client_id')!
    expect(t('commande').indexes).toEqual([expect.objectContaining({ name: 'idx_commande_client', columns: [fk.id] })])
    expect(t('migrations').columns).toHaveLength(1)
    expect(t('commande_produit').columns.map(c => c.name).sort()).toEqual(['commande_id', 'produit_id', 'quantite'])
  })
})
