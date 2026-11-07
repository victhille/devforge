import type { DiagramEdge, DiagramEdgeType, DiagramKind, DiagramModel, DiagramNode, DiagramNodeType } from '../types/modeling'
import { EDGE_TYPES, nextMessageY, NODE_TYPES, nodeBox } from './uml'
import { McdSpecError as SpecError } from './mcdSpec'

/**
 * v4.2 lot 3: a diagram from a description (what Forgy writes from the
 * user's words): its parts, named, and the links between them by those
 * names. Checked against the kind's parts and links, then laid out the way
 * that kind reads: a sequence in a row with its messages in order, use cases
 * beside their actors inside the system, the others in layers along their links.
 */

export interface DiagramSpec {
  nodes: { name: string; type?: string; attributes?: string[]; methods?: string[]; steps?: string[] }[]
  links?: { from: string; to: string; type?: string; label?: string }[]
}

const MAX = { nodes: 80, links: 150, lines: 40 }
/** The part a name alone makes, per kind */
const DEFAULT_TYPE: Record<DiagramKind, DiagramNodeType> = { usecase: 'case', class: 'class', sequence: 'participant', flow: 'step', architecture: 'service' }
const GAP = { x: 70, y: 70 }
/** Parts in a layer before it wraps */
const ROW = 5

const clean = (v: unknown, max = 120) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const lines = (v: unknown, owner: string, what: string) => {
  if (v === undefined) return undefined
  if (!Array.isArray(v)) throw new SpecError(`"${what}" of ${owner} must be a list of texts`)
  return v.slice(0, MAX.lines).map(x => clean(x, 200)).filter(Boolean)
}

export function diagramFromSpec(kind: DiagramKind, spec: unknown): DiagramModel {
  const s = spec as DiagramSpec
  if (!s || !Array.isArray(s.nodes) || !s.nodes.length) throw new SpecError('Give at least one part in "nodes"')
  if (s.nodes.length > MAX.nodes) throw new SpecError(`At most ${MAX.nodes} parts`)
  const links = s.links ?? []
  if (!Array.isArray(links)) throw new SpecError('"links" must be a list')
  if (links.length > MAX.links) throw new SpecError(`At most ${MAX.links} links`)
  const types = NODE_TYPES[kind], edgeTypes = EDGE_TYPES[kind]
  let n = 0
  const next = (p: string) => `${p}${(++n).toString(36)}`

  const byName = new Map<string, DiagramNode>()
  const nodes: DiagramNode[] = s.nodes.map(x => {
    const name = clean(x?.name)
    if (!name) throw new SpecError('A part has no name')
    if (byName.has(name.toLowerCase())) throw new SpecError(`Two parts are named ${name}: links name them, so each name must be unique`)
    const raw = clean(x.type, 40).toLowerCase()
    const type = (raw || DEFAULT_TYPE[kind]) as DiagramNodeType
    if (!types.includes(type)) throw new SpecError(`"${x.type}" is not a part of a ${kind} diagram: use ${types.join(', ')}`)
    const node: DiagramNode = {
      id: next('n'), type, name, x: 0, y: 0,
      ...(type === 'class' || type === 'interface' ? { attributes: lines(x.attributes, name, 'attributes') ?? [], methods: lines(x.methods, name, 'methods') ?? [] } : {}),
      ...(type === 'enum' ? { attributes: lines(x.attributes, name, 'attributes') ?? [] } : {}),
      ...(type === 'case' && x.steps !== undefined ? { steps: lines(x.steps, name, 'steps') } : {})
    }
    byName.set(name.toLowerCase(), node)
    return node
  })

  const edges: DiagramEdge[] = links.map(l => {
    const from = byName.get(clean(l?.from).toLowerCase()), to = byName.get(clean(l?.to).toLowerCase())
    if (!from || !to) throw new SpecError(`A link names an unknown part: "${!from ? l?.from : l?.to}" (declare it in "nodes")`)
    const raw = clean(l.type, 40).toLowerCase()
    const type = (raw || edgeTypes[0]) as DiagramEdgeType
    if (!edgeTypes.includes(type)) throw new SpecError(`"${l.type}" is not a link of a ${kind} diagram: use ${edgeTypes.join(', ')}`)
    if (from.type === 'system' || to.type === 'system') throw new SpecError(`The system ${from.type === 'system' ? from.name : to.name} holds the use cases: link its cases, not the system`)
    const label = clean(l.label)
    return { id: next('l'), type, from: from.id, to: to.id, ...(label ? { label } : {}) }
  })

  const diagram: DiagramModel = { nodes, edges, notes: [] }
  if (kind === 'sequence') layoutSequence(diagram)
  else if (kind === 'usecase') layoutUseCases(diagram)
  else layoutLayers(diagram, kind)
  return diagram
}

/** The participants in a row, the messages one below the other in the order given */
function layoutSequence(d: DiagramModel): void {
  let x = 0
  for (const n of d.nodes) { n.x = x; n.y = 0; x += nodeBox(n).w + GAP.x }
  const placed: DiagramEdge[] = []
  for (const e of d.edges) { e.y = nextMessageY({ ...d, edges: placed }); placed.push(e) }
}

/** The actors in a column on the left, the use cases beside them (two columns past eight), inside the system when there is one */
function layoutUseCases(d: DiagramModel): void {
  const actors = d.nodes.filter(n => n.type === 'actor'), cases = d.nodes.filter(n => n.type === 'case'), systems = d.nodes.filter(n => n.type === 'system')
  const columns = cases.length > 8 ? 2 : 1
  const caseW = Math.max(140, ...cases.map(c => nodeBox(c).w))
  const left = Math.max(70, ...actors.map(a => nodeBox(a).w)) + 120
  let y = 60
  cases.forEach((c, i) => {
    const col = i % columns
    c.x = left + 40 + col * (caseW + 50)
    c.y = y
    if (col === columns - 1 || i === cases.length - 1) y += Math.max(...cases.slice(i - col, i + 1).map(x => nodeBox(x).h)) + 30
  })
  const casesH = Math.max(y - 30, 120)
  let ay = Math.max(0, (casesH - actors.length * 130) / 2)
  for (const a of actors) { a.x = 0; a.y = Math.round(ay); ay += 130 }
  // The system around the cases; any other one below it
  systems.forEach((sys, i) => {
    sys.x = left
    sys.y = i === 0 ? 0 : casesH + 60 + (i - 1) * 200
    sys.w = i === 0 ? columns * caseW + (columns - 1) * 50 + 80 : 420
    sys.h = i === 0 ? casesH + 40 : 160
  })
  // A system first: drawn behind the cases
  d.nodes.sort((a, b) => Number(b.type === 'system') - Number(a.type === 'system'))
}

/**
 * Layers along the links: a flowchart from the top down, an architecture
 * from left to right (client, gateway, services, data), classes under the
 * class they extend. Each layer wraps past five parts.
 */
function layoutLayers(d: DiagramModel, kind: DiagramKind): void {
  // Classes: a parent above its children; the other links do not order them
  const order = kind === 'class'
    ? d.edges.filter(e => e.type === 'inheritance' || e.type === 'implementation').map(e => [e.to, e.from] as const)
    : d.edges.map(e => [e.from, e.to] as const)
  const ins = new Map(d.nodes.map(x => [x.id, 0]))
  for (const [, to] of order) ins.set(to, (ins.get(to) ?? 0) + 1)
  // Breadth first from the parts nothing leads to (then from any part left), so a loop never stretches it
  const rank = new Map<string, number>()
  const walk = (start: string) => {
    const queue = [start]
    rank.set(start, rank.get(start) ?? 0)
    while (queue.length) {
      const id = queue.shift()!
      for (const [from, to] of order) if (from === id && !rank.has(to)) { rank.set(to, rank.get(id)! + 1); queue.push(to) }
    }
  }
  for (const x of d.nodes) if (!ins.get(x.id) && !rank.has(x.id)) walk(x.id)
  for (const x of d.nodes) if (!rank.has(x.id)) walk(x.id)

  const layers: DiagramNode[][] = []
  for (const x of d.nodes) {
    const r = rank.get(x.id)!
    ;(layers[r] ??= []).push(x)
  }
  const rows = layers.filter(Boolean).flatMap(layer => Array.from({ length: Math.ceil(layer.length / ROW) }, (_, i) => layer.slice(i * ROW, i * ROW + ROW)))
  const across = kind === 'architecture'
  let at = 0
  for (const row of rows) {
    const boxes = row.map(nodeBox)
    const length = boxes.reduce((sum, b) => sum + (across ? b.h : b.w), 0) + (row.length - 1) * (across ? GAP.y : GAP.x)
    let along = -length / 2
    row.forEach((x, i) => {
      const b = boxes[i]
      if (across) { x.x = at; x.y = Math.round(along) } else { x.x = Math.round(along); x.y = at }
      along += (across ? b.h + GAP.y : b.w + GAP.x)
    })
    at += Math.max(...boxes.map(b => (across ? b.w : b.h))) + (across ? GAP.x + 40 : GAP.y)
  }
}
