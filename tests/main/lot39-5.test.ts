import { describe, expect, it } from 'vitest'
import type { DiagramKind } from '@shared/types'
import { caseLinks, cleanDiagram, DIAGRAM_KINDS, diagramBounds, diagramSvg, EDGE_TYPES, edgeLine, nextMessageY, NODE_TYPES, nodeBox } from '@shared/lib/uml'
import { createModel, listModels, readModel, saveModel } from '../../src/main/services/modeling/models'
import { saveProjects, tempDir } from '../helpers'
import { samples } from '../diagrams'

/** v3.9 lot 5: use cases, classes, sequence, flowchart, architecture */

const COLORS = { canvas: '#000', card: '#111', line: '#888', text: '#fff', muted: '#999', accent: '#c7f', actor: '#fc6', system: '#59f', note: '#330', noteText: '#fff' }

describe('the diagrams', () => {
  it('each sample is only made of its kind’s parts, and reads back as it is', () => {
    for (const kind of DIAGRAM_KINDS) {
      const d = samples[kind]()
      expect(d.nodes.every(n => NODE_TYPES[kind].includes(n.type)), kind).toBe(true)
      expect(d.edges.every(e => EDGE_TYPES[kind].includes(e.type)), kind).toBe(true)
      expect(cleanDiagram(JSON.parse(JSON.stringify(d)), kind)).toEqual(d)
    }
  })

  it('a part of another kind, a link to nothing, are put right or dropped', () => {
    const d = cleanDiagram({ nodes: [{ id: 'a', type: 'database', name: 'x' }, { id: 'b', type: 'case', name: 'y' }], edges: [{ id: 'l', type: 'flow', from: 'a', to: 'b' }, { id: 'm', from: 'a', to: 'zz' }] }, 'usecase')
    expect(d.nodes.map(n => n.type)).toEqual(['actor', 'case'])
    expect(d.edges).toEqual([{ id: 'l', type: 'association', from: 'a', to: 'b' }])
    expect(cleanDiagram(null, 'flow')).toEqual({ nodes: [], edges: [], notes: [] })
  })

  it('draws every kind as a whole picture', () => {
    for (const kind of DIAGRAM_KINDS) {
      const svg = diagramSvg(kind, samples[kind](), COLORS)
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), kind).toBe(true)
      expect(svg.split('<text').length, kind).toBe(svg.split('</text>').length)
      for (const n of samples[kind]().nodes) expect(svg, `${kind} ${n.name}`).toContain(n.name.replace(/&/g, '&amp;'))
    }
    const uml = diagramSvg('usecase', samples.usecase(), COLORS)
    expect(uml).toContain('«include»')
    expect(uml).toContain('marker-end="url(#dg-open)"')
    expect(diagramSvg('class', samples.class(), COLORS)).toContain('marker-start="url(#dg-diamond)"')
    expect(diagramSvg('class', samples.class(), COLORS)).toContain('«enum»')
  })

  it('sizes follow the text; a class grows with its members', () => {
    const c = samples.class().nodes[0]
    const small = nodeBox({ ...c, attributes: [], methods: [] })
    const big = nodeBox(c)
    expect(big.h).toBeGreaterThan(small.h)
    expect(nodeBox({ id: 's', type: 'system', name: 'S', x: 0, y: 0, w: 500, h: 200 })).toEqual({ x: 0, y: 0, w: 500, h: 200 })
    const all = diagramBounds('usecase', samples.usecase())
    expect(all.x).toBe(0)
    expect(all.w).toBeGreaterThan(700)
  })

  it('a sequence: messages straight across, at their height, in order', () => {
    const d = samples.sequence()
    const line = edgeLine('sequence', d, d.edges[1])!
    expect(line.from.y).toBe(174)
    expect(line.to.y).toBe(174)
    expect(line.self).toBe(false)
    expect(edgeLine('sequence', d, d.edges[4])!.self).toBe(true)
    expect(nextMessageY(d)).toBe(350)
  })

  it('a use case’s actors, what it includes, what extends it', () => {
    expect(caseLinks(samples.usecase(), 'cmd')).toEqual({ actors: ['Client'], includes: ['Payer'], extendedBy: ['Appliquer un coupon'] })
    expect(caseLinks(samples.usecase(), 'pai').actors).toEqual(['Prestataire de paiement'])
  })
})

describe('diagrams in the project', () => {
  it('each kind is created empty, saved and listed with its drawing', () => {
    const project = tempDir('shop')
    saveProjects([{ name: 'shop', path: project }])
    for (const kind of DIAGRAM_KINDS) {
      const file = createModel(project, kind, 'Parcours')
      expect(file).toBe(`parcours.${kind}.json`)
      expect(readModel(project, file).diagram).toEqual({ nodes: [], edges: [], notes: [] })
      saveModel(project, file, { v: 1, kind, name: 'Parcours', updatedAt: '', diagram: samples[kind]() })
      expect(readModel(project, file).diagram).toEqual(samples[kind]())
    }
    const listed = listModels(project)
    expect(listed.map(m => m.kind).sort()).toEqual([...DIAGRAM_KINDS].sort() as DiagramKind[])
    expect(listed.every(m => m.diagram?.nodes.length)).toBe(true)
  })
})
