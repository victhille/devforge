import { describe, expect, it } from 'vitest'
import type { DiagramModel, McdModel, MpdModel } from '@shared/types'
import type { Box } from '@shared/lib/mcd'
import { DEFAULT_NAMING } from '@shared/lib/mpd'
import { align, distribute, pasteShift, placed } from '@shared/lib/arrange'
import { copyDiagram, copyMcd, copyMpd, pasteDiagram, pasteMcd, pasteMpd, uniqueName } from '@shared/lib/clip'

/** v4.2 lot 2: the selection lined up and spread out; parts copied, pasted, duplicated */

const boxes = (...list: [string, number, number, number, number][]) => new Map<string, Box>(list.map(([id, x, y, w, h]) => [id, { x, y, w, h }]))

describe('align', () => {
  const three = boxes(['a', 10, 0, 100, 40], ['b', 200, 50, 60, 80], ['c', 50, 300, 140, 20])

  it('lines the parts up on the selection’s edges and middles', () => {
    expect(align(three, 'left')).toEqual(new Map([['a', { x: 10, y: 0 }], ['b', { x: 10, y: 50 }], ['c', { x: 10, y: 300 }]]))
    // Right edge: 260, so each one ends there
    expect([...align(three, 'right').values()].map(p => p.x)).toEqual([160, 200, 120])
    // Middle of 10…260: 135
    expect([...align(three, 'center').values()].map(p => p.x)).toEqual([85, 105, 65])
    expect([...align(three, 'top').values()].map(p => p.y)).toEqual([0, 0, 0])
    expect([...align(three, 'bottom').values()].map(p => p.y)).toEqual([280, 240, 300])
    expect([...align(three, 'middle').values()].map(p => p.y)).toEqual([140, 120, 150])
  })

  it('leaves a lone part where it is', () => {
    expect(align(boxes(['a', 10, 0, 100, 40]), 'left').size).toBe(0)
  })
})

describe('distribute', () => {
  it('puts the same space between neighbours, the first and the last staying', () => {
    // Taken in order of their middle: a (0), c (90), b (300)
    const out = distribute(boxes(['a', 0, 0, 100, 40], ['b', 300, 10, 100, 40], ['c', 90, 20, 50, 40]), 'x')
    // 400 wide, 250 of parts: 75 between each
    expect(out.get('a')).toEqual({ x: 0, y: 0 })
    expect(out.get('c')).toEqual({ x: 175, y: 20 })
    expect(out.get('b')).toEqual({ x: 300, y: 10 })
  })

  it('needs three parts', () => {
    expect(distribute(boxes(['a', 0, 0, 10, 10], ['b', 50, 0, 10, 10]), 'y').size).toBe(0)
  })
})

describe('pasteShift and placed', () => {
  const seen = { x: 0, y: 0, w: 800, h: 600 }

  it('pastes a step aside while the copied parts are on screen, else in its middle', () => {
    expect(pasteShift({ x: 100, y: 100, w: 50, h: 50 }, seen, 1)).toEqual({ x: 24, y: 24 })
    expect(pasteShift({ x: 100, y: 100, w: 50, h: 50 }, seen, 2)).toEqual({ x: 48, y: 48 })
    // Far away: its middle (2025, 2025) goes to the screen's (400, 300)
    expect(pasteShift({ x: 2000, y: 2000, w: 50, h: 50 }, seen, 1)).toEqual({ x: -1625, y: -1725 })
  })

  it('moves only the parts given, a row kept when asked', () => {
    const list = [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5, y: 5 }]
    const to = new Map([['a', { x: 10, y: 20 }]])
    expect(placed(list, to)).toEqual([{ id: 'a', x: 10, y: 20 }, { id: 'b', x: 5, y: 5 }])
    expect(placed(list, to, true)[0]).toEqual({ id: 'a', x: 10, y: 0 })
  })
})

describe('uniqueName', () => {
  it('numbers a name already taken, a copy of a copy going on with the count', () => {
    const taken = new Set(['CLIENT', 'CLIENT_2'])
    expect(uniqueName('CLIENT', taken)).toBe('CLIENT_3')
    expect(uniqueName('CLIENT_2', taken)).toBe('CLIENT_4')
    expect(uniqueName('COMMANDE', taken)).toBe('COMMANDE')
    expect(uniqueName('Client', new Set(['CLIENT']), ' ')).toBe('Client 2')
  })
})

describe('copy and paste', () => {
  const mcd: McdModel = {
    entities: [
      { id: 'e1', name: 'CLIENT', x: 0, y: 0, attributes: [{ id: 'a1', name: 'id_client', type: 'int', identifier: true }] },
      { id: 'e2', name: 'COMMANDE', x: 300, y: 0, attributes: [] }
    ],
    associations: [{ id: 's1', name: 'PASSER', x: 150, y: 0, attributes: [] }],
    links: [{ id: 'l1', entity: 'e1', association: 's1', card: '0,n' }, { id: 'l2', entity: 'e2', association: 's1', card: '1,1' }],
    notes: [{ id: 't1', x: 0, y: 200, text: 'à revoir' }]
  }

  it('an MCD copy keeps the legs between the parts copied, with new ids and names', () => {
    const copy = copyMcd(mcd, ['e1', 's1'])
    expect(copy.links.map(l => l.id)).toEqual(['l1'])
    const { mcd: out, ids } = pasteMcd(mcd, copy, { x: 24, y: 24 })
    expect(out.entities.map(x => x.name)).toEqual(['CLIENT', 'COMMANDE', 'CLIENT_2'])
    expect(out.associations.map(x => x.name)).toEqual(['PASSER', 'PASSER_2'])
    const [entity, association] = [out.entities[2], out.associations[1]]
    expect(ids).toEqual([entity.id, association.id])
    expect([entity.x, entity.y]).toEqual([24, 24])
    expect(entity.attributes[0].id).not.toBe('a1')
    expect(out.links.slice(2)).toEqual([expect.objectContaining({ entity: entity.id, association: association.id, card: '0,n' })])
    // The original is untouched
    expect(out.links.slice(0, 2)).toEqual(mcd.links)
  })

  it('a diagram copy keeps its links; a sequence’s participants stay in their row; a system goes behind', () => {
    const dg: DiagramModel = {
      nodes: [
        { id: 'n1', type: 'participant', name: 'Client', x: 0, y: 0 },
        { id: 'n2', type: 'participant', name: 'API', x: 200, y: 0 },
        { id: 'n3', type: 'system', name: 'Boutique', x: 0, y: 300, w: 400, h: 300 }
      ],
      edges: [{ id: 'm1', type: 'message', from: 'n1', to: 'n2', y: 120 }],
      notes: []
    }
    const { diagram, ids } = pasteDiagram(dg, copyDiagram(dg, ['n1', 'n2']), { x: 400, y: 50 }, true)
    expect(diagram.nodes.slice(3).map(n => [n.name, n.x, n.y])).toEqual([['Client 2', 400, 0], ['API 2', 600, 0]])
    expect(diagram.edges[1]).toEqual(expect.objectContaining({ from: ids[0], to: ids[1], y: 120 }))
    const withSystem = pasteDiagram(dg, copyDiagram(dg, ['n3']), { x: 24, y: 24 })
    expect(withSystem.diagram.nodes[0].name).toBe('Boutique 2')
  })

  it('an MPD copy points its keys at the copies made with it, else at the same table; no more tie to the MCD', () => {
    const mpd: MpdModel = {
      engine: 'postgres', naming: DEFAULT_NAMING,
      tables: [
        { id: 'tA', name: 'auteur', x: 0, y: 0, from: 'e9', indexes: [], columns: [{ id: 'cA', name: 'id', type: 'int', pk: true, from: 'k' }] },
        {
          id: 'tB', name: 'article', x: 300, y: 0, from: 'e8',
          columns: [{ id: 'cB', name: 'id', type: 'int', pk: true }, { id: 'cF', name: 'auteur_id', type: 'int', ref: { table: 'tA', column: 'cA' } }],
          indexes: [{ id: 'i1', name: 'idx_article_auteur', columns: ['cF'] }]
        }
      ]
    }
    // article alone: its key still points at auteur
    const alone = pasteMpd(mpd, copyMpd(mpd, ['tB']), { x: 24, y: 24 }).mpd.tables[2]
    expect(alone.name).toBe('article_2')
    expect(alone.from).toBeUndefined()
    expect(alone.columns[1].ref).toEqual({ table: 'tA', column: 'cA' })
    expect(alone.indexes[0]).toEqual(expect.objectContaining({ name: 'idx_article_2_auteur', columns: [alone.columns[1].id] }))
    // Both: the copy of article points at the copy of auteur
    const both = pasteMpd(mpd, copyMpd(mpd, ['tA', 'tB']), { x: 24, y: 24 }).mpd.tables
    const [auteur2, article2] = both.slice(2)
    expect(article2.columns[1].ref).toEqual({ table: auteur2.id, column: auteur2.columns[0].id })
    expect(auteur2.columns[0].from).toBeUndefined()
  })
})
