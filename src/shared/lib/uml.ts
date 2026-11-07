import type { DiagramEdge, DiagramEdgeType, DiagramKind, DiagramModel, DiagramNode, DiagramNodeType, ModelNote } from '../types/modeling'
import { bounds, center, edgePoint, noteBox, uid, wrap, type Box, type Point } from './mcd'

/**
 * v3.9 lot 5: the diagrams of the Modeling page — use cases, classes,
 * sequence, flowchart, architecture. One model (nodes, edges, notes), one
 * drawing shared by the editor, the thumbnails and the export.
 */

export const DIAGRAM_KINDS: DiagramKind[] = ['usecase', 'class', 'sequence', 'flow', 'architecture']
export const isDiagramKind = (k: string): k is DiagramKind => (DIAGRAM_KINDS as string[]).includes(k)

/** What each kind's palette offers */
export const NODE_TYPES: Record<DiagramKind, DiagramNodeType[]> = {
  usecase: ['actor', 'case', 'system'],
  class: ['class', 'interface', 'enum'],
  sequence: ['actor', 'participant'],
  flow: ['start', 'step', 'decision', 'io', 'end'],
  architecture: ['client', 'gateway', 'service', 'database', 'queue', 'external']
}
export const EDGE_TYPES: Record<DiagramKind, DiagramEdgeType[]> = {
  usecase: ['association', 'include', 'extend', 'generalization'],
  class: ['association', 'inheritance', 'implementation', 'composition', 'aggregation', 'dependency'],
  sequence: ['message', 'return'],
  flow: ['flow'],
  architecture: ['link']
}

export const emptyDiagram = (): DiagramModel => ({ nodes: [], edges: [], notes: [] })

// ── Sizes ────────────────────────────────────────────────────────────────────

const CH = 7
const ROW = 18
const len = (s: string) => s.length * CH
/** A class's header, with its stereotype when it has one */
const stereotype = (t: DiagramNodeType) => (t === 'interface' ? '«interface»' : t === 'enum' ? '«enum»' : '')

export function nodeBox(n: DiagramNode): Box {
  const at = (w: number, h: number): Box => ({ x: n.x, y: n.y, w: Math.round(w), h: Math.round(h) })
  const name = n.name || '—'
  switch (n.type) {
    case 'actor': return at(Math.max(70, len(name) + 10), 96)
    case 'case': { const lines = wrap(name, 24).length; return at(Math.min(260, Math.max(140, len(name.slice(0, 24)) + 56)), 44 + lines * 16) }
    case 'system': return at(n.w ?? 420, n.h ?? 340)
    case 'class': case 'interface': case 'enum': {
      const attrs = n.attributes ?? [], methods = n.type === 'enum' ? [] : (n.methods ?? [])
      const widest = Math.max(len(name) + 30, len(stereotype(n.type)), ...attrs.map(len), ...methods.map(len))
      const head = 30 + (stereotype(n.type) ? 14 : 0)
      return at(Math.max(160, widest + 24), head + Math.max(1, attrs.length) * ROW + 8 + (n.type === 'enum' ? 0 : Math.max(1, methods.length) * ROW + 8))
    }
    case 'participant': return at(Math.max(110, len(name) + 30), 40)
    case 'start': case 'end': return at(Math.max(110, len(name) + 40), 40)
    case 'step': return at(Math.max(150, len(name) + 30), 50)
    case 'decision': return at(Math.max(150, len(name) + 70), 84)
    case 'io': return at(Math.max(160, len(name) + 56), 50)
    case 'database': return at(Math.max(120, len(name) + 30), 78)
    case 'client': return at(Math.max(140, len(name) + 30), 64)
    case 'gateway': return at(Math.max(160, len(name) + 50), 60)
    default: return at(Math.max(150, len(name) + 30), n.type === 'queue' ? 50 : 60)
  }
}

/** Where a sequence's lifelines stop: below the last message */
export function lifelineEnd(m: DiagramModel): number {
  const parts = m.nodes.filter(n => n.type === 'participant' || n.type === 'actor')
  const top = Math.max(0, ...parts.map(n => n.y + nodeBox(n).h))
  return Math.max(top + 120, ...m.edges.map(e => (e.y ?? 0) + 50))
}

/** The next message's height: below the others */
export function nextMessageY(m: DiagramModel): number {
  const parts = m.nodes.filter(n => n.type === 'participant' || n.type === 'actor')
  const top = Math.max(0, ...parts.map(n => n.y + nodeBox(n).h))
  return Math.max(top + 50, ...m.edges.map(e => (e.y ?? 0) + 44))
}

export function diagramBounds(kind: DiagramKind, m: DiagramModel): Box {
  const boxes = [...m.nodes.map(nodeBox), ...m.notes.map(noteBox)]
  if (kind === 'sequence' && m.nodes.length) {
    const b = bounds(boxes)
    boxes.push({ x: b.x, y: b.y, w: b.w, h: lifelineEnd(m) - b.y })
  }
  return bounds(boxes)
}

// ── Lines ────────────────────────────────────────────────────────────────────

const ROUND: DiagramNodeType[] = ['case', 'start', 'end']

/** An edge from border to border; a sequence message straight across, at its height */
export function edgeLine(kind: DiagramKind, m: DiagramModel, e: DiagramEdge): { from: Point; to: Point; mid: Point; handle: Point; self: boolean } | null {
  const a = m.nodes.find(n => n.id === e.from), b = m.nodes.find(n => n.id === e.to)
  if (!a || !b) return null
  const ba = nodeBox(a), bb = nodeBox(b)
  if (kind === 'sequence') {
    const y = e.y ?? 0
    const x1 = ba.x + ba.w / 2, x2 = bb.x + bb.w / 2
    if (a.id === b.id) return { from: { x: x1, y }, to: { x: x1, y: y + 24 }, mid: { x: x1 + 50, y: y + 12 }, handle: { x: x1 + 44, y: y + 12 }, self: true }
    // The dot that moves a message sits by its start, its label in the middle above it
    return { from: { x: x1, y }, to: { x: x2, y }, mid: { x: (x1 + x2) / 2, y: y - 12 }, handle: { x: x1 + Math.sign(x2 - x1) * 16, y }, self: false }
  }
  if (a.id === b.id) {
    const p = { x: ba.x + ba.w, y: ba.y + ba.h / 2 }
    return { from: p, to: { x: p.x, y: p.y + 20 }, mid: { x: p.x + 40, y: p.y + 10 }, handle: { x: p.x + 46, y: p.y + 10 }, self: true }
  }
  const from = edgePoint(ba, center(bb), ROUND.includes(a.type))
  const to = edgePoint(bb, center(ba), ROUND.includes(b.type))
  // The dot that picks a link a quarter of the way, so its label stays readable
  return { from, to, mid: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }, handle: { x: from.x + (to.x - from.x) * 0.25, y: from.y + (to.y - from.y) * 0.25 }, self: false }
}

// ── Drawing ──────────────────────────────────────────────────────────────────

/** Colours; the editor gives CSS variables, the export real colours */
export interface DiagramColors { canvas: string; card: string; line: string; text: string; muted: string; accent: string; actor: string; system: string; note: string; noteText: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const DASHED: DiagramEdgeType[] = ['include', 'extend', 'implementation', 'dependency', 'return']

/** The markers at an edge's ends (UML: a hollow triangle for inheritance, a diamond for composition…) */
function ends(t: DiagramEdgeType): { start?: string; end?: string } {
  switch (t) {
    case 'association': return {}
    case 'generalization': case 'inheritance': case 'implementation': return { end: 'tri' }
    case 'composition': return { start: 'diamond' }
    case 'aggregation': return { start: 'odiamond' }
    case 'include': case 'extend': case 'dependency': case 'return': return { end: 'open' }
    default: return { end: 'arrow' }
  }
}

/**
 * The diagram's shapes in its own coordinates (no frame): the editor puts them
 * on its canvas, diagramSvg in a picture.
 */
export function diagramShapes(kind: DiagramKind, m: DiagramModel, c: DiagramColors): string {
  const st = (fill: string, stroke = c.line, extra = '') => `style="fill:${fill};stroke:${stroke};${extra}"`
  const text = (x: number, y: number, s: string, o: { size?: number; weight?: number; anchor?: string; fill?: string; italic?: boolean; underline?: boolean } = {}) =>
    `<text x="${x}" y="${y}" text-anchor="${o.anchor ?? 'middle'}" style="fill:${o.fill ?? c.text};font-size:${o.size ?? 12}px;font-weight:${o.weight ?? 400};${o.italic ? 'font-style:italic;' : ''}${o.underline ? 'text-decoration:underline;' : ''}">${esc(s)}</text>`
  const out: string[] = [
    `<defs>`,
    `<marker id="dg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" ${st(c.line, c.line)}/></marker>`,
    `<marker id="dg-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" ${st('none', c.line, 'stroke-width:1.4')}/></marker>`,
    `<marker id="dg-tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse"><path d="M0 0L12 6L0 12z" ${st(c.canvas, c.line, 'stroke-width:1.2')}/></marker>`,
    `<marker id="dg-diamond" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M0 5L8 0L16 5L8 10z" ${st(c.line, c.line)}/></marker>`,
    `<marker id="dg-odiamond" viewBox="0 0 16 10" refX="15" refY="5" markerWidth="16" markerHeight="10" orient="auto-start-reverse"><path d="M0 5L8 0L16 5L8 10z" ${st(c.canvas, c.line, 'stroke-width:1.2')}/></marker>`,
    `</defs>`
  ]

  // Systems behind everything, lifelines behind the messages
  for (const n of m.nodes.filter(x => x.type === 'system')) {
    const b = nodeBox(n)
    out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" ${st('none', c.system, 'stroke-width:1.5')}/>`, text(b.x + 14, b.y + 22, n.name, { anchor: 'start', weight: 700, size: 13, fill: c.system }))
  }
  if (kind === 'sequence') {
    const end = lifelineEnd(m)
    for (const n of m.nodes) {
      const b = nodeBox(n)
      out.push(`<line x1="${b.x + b.w / 2}" y1="${b.y + b.h}" x2="${b.x + b.w / 2}" y2="${end}" ${st('none', c.muted, 'stroke-width:1.2;stroke-dasharray:5 4')}/>`)
    }
  }

  for (const e of m.edges) {
    const l = edgeLine(kind, m, e)
    if (!l) continue
    const { start, end } = ends(e.type)
    const marks = `${start ? ` marker-start="url(#dg-${start})"` : ''}${end ? ` marker-end="url(#dg-${end})"` : ''}`
    const dash = DASHED.includes(e.type) ? 'stroke-dasharray:6 4;' : ''
    const d = l.self ? `M${l.from.x} ${l.from.y} C${l.from.x + 60} ${l.from.y - 6}, ${l.to.x + 60} ${l.to.y + 6}, ${l.to.x} ${l.to.y}` : `M${l.from.x} ${l.from.y} L${l.to.x} ${l.to.y}`
    out.push(`<path d="${d}" ${st('none', c.line, `stroke-width:1.4;${dash}`)}${marks}/>`)
    const label = e.type === 'include' ? '«include»' : e.type === 'extend' ? '«extend»' : e.label ?? ''
    if (label) {
      const w = len(label) + 10
      out.push(`<rect x="${l.mid.x - w / 2}" y="${l.mid.y - 9}" width="${w}" height="16" rx="4" ${st(c.canvas, 'none')}/>`, text(l.mid.x, l.mid.y + 3, label, { size: 11, fill: c.muted }))
    }
  }

  for (const n of m.nodes) {
    if (n.type === 'system') continue
    const b = nodeBox(n)
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2
    const name = n.name || '—'
    switch (n.type) {
      case 'actor': {
        const s = st('none', c.actor, 'stroke-width:1.6')
        out.push(`<circle cx="${cx}" cy="${b.y + 10}" r="9" ${s}/>`, `<path d="M${cx} ${b.y + 19}V${b.y + 48}M${cx - 16} ${b.y + 29}H${cx + 16}M${cx} ${b.y + 48}L${cx - 13} ${b.y + 68}M${cx} ${b.y + 48}L${cx + 13} ${b.y + 68}" ${s}/>`,
          text(cx, b.y + 86, name, { weight: 600 }))
        break
      }
      case 'case': {
        out.push(`<ellipse cx="${cx}" cy="${cy}" rx="${b.w / 2}" ry="${b.h / 2}" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`)
        const lines = wrap(name, 24)
        lines.forEach((t, i) => out.push(text(cx, cy + 4 + (i - (lines.length - 1) / 2) * 16, t)))
        break
      }
      case 'class': case 'interface': case 'enum': {
        const s = stereotype(n.type)
        const head = 30 + (s ? 14 : 0)
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`)
        if (s) out.push(text(cx, b.y + 16, s, { size: 11, fill: c.muted }))
        out.push(text(cx, b.y + head - 10, name, { weight: 700, size: 13, italic: n.type === 'interface' }))
        out.push(`<line x1="${b.x}" y1="${b.y + head}" x2="${b.x + b.w}" y2="${b.y + head}" ${st('none', c.accent, 'stroke-width:1.2')}/>`)
        const attrs = n.attributes ?? []
        attrs.forEach((a, i) => out.push(text(b.x + 12, b.y + head + 16 + i * ROW, a, { anchor: 'start', size: 12 })))
        if (n.type !== 'enum') {
          const y = b.y + head + Math.max(1, attrs.length) * ROW + 8
          out.push(`<line x1="${b.x}" y1="${y}" x2="${b.x + b.w}" y2="${y}" ${st('none', c.accent, 'stroke-width:1.2')}/>`)
          ;(n.methods ?? []).forEach((a, i) => out.push(text(b.x + 12, y + 16 + i * ROW, a, { anchor: 'start', size: 12 })))
        }
        break
      }
      case 'participant': case 'step': case 'service': case 'external':
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${n.type === 'step' ? 8 : 6}" ${st(c.card, n.type === 'external' ? c.muted : c.accent, `stroke-width:1.5;${n.type === 'external' ? 'stroke-dasharray:6 4;' : ''}`)}/>`, text(cx, cy + 4, name, { weight: 600 }))
        break
      case 'start': case 'end':
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" ${st(n.type === 'start' ? c.accent : c.card, c.accent, 'stroke-width:1.5')}/>`, text(cx, cy + 4, name, { weight: 700, fill: n.type === 'start' ? c.canvas : c.text }))
        break
      case 'decision':
        out.push(`<path d="M${cx} ${b.y}L${b.x + b.w} ${cy}L${cx} ${b.y + b.h}L${b.x} ${cy}z" ${st(c.card, c.actor, 'stroke-width:1.5')}/>`, text(cx, cy + 4, name, { weight: 600 }))
        break
      case 'io': {
        const k = 16
        out.push(`<path d="M${b.x + k} ${b.y}H${b.x + b.w}L${b.x + b.w - k} ${b.y + b.h}H${b.x}z" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`, text(cx, cy + 4, name, { weight: 600 }))
        break
      }
      case 'database': {
        const r = 10
        out.push(`<path d="M${b.x} ${b.y + r}V${b.y + b.h - r}A${b.w / 2} ${r} 0 0 0 ${b.x + b.w} ${b.y + b.h - r}V${b.y + r}" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`,
          `<ellipse cx="${cx}" cy="${b.y + r}" rx="${b.w / 2}" ry="${r}" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`, text(cx, cy + 8, name, { weight: 600 }))
        break
      }
      case 'queue': {
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.h / 2}" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`)
        for (const dx of [0.72, 0.8, 0.88]) out.push(`<line x1="${b.x + b.w * dx}" y1="${b.y + 10}" x2="${b.x + b.w * dx}" y2="${b.y + b.h - 10}" ${st('none', c.muted, 'stroke-width:1.2')}/>`)
        out.push(text(b.x + b.w * 0.36, cy + 4, name, { weight: 600 }))
        break
      }
      case 'client':
        out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h - 12}" rx="6" ${st(c.card, c.accent, 'stroke-width:1.5')}/>`,
          `<path d="M${cx - 16} ${b.y + b.h}H${cx + 16}M${cx} ${b.y + b.h - 12}V${b.y + b.h}" ${st('none', c.accent, 'stroke-width:1.5')}/>`, text(cx, cy - 2, name, { weight: 600 }))
        break
      case 'gateway': {
        const k = 18
        out.push(`<path d="M${b.x + k} ${b.y}H${b.x + b.w - k}L${b.x + b.w} ${cy}L${b.x + b.w - k} ${b.y + b.h}H${b.x + k}L${b.x} ${cy}z" ${st(c.card, c.actor, 'stroke-width:1.5')}/>`, text(cx, cy + 4, name, { weight: 600 }))
        break
      }
    }
  }

  for (const n of m.notes) {
    const b = noteBox(n)
    out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" ${st(c.note, 'none')}/>`)
    wrap(n.text, 24).forEach((line, i) => out.push(text(b.x + 10, b.y + 20 + i * 17, line, { anchor: 'start', fill: c.noteText })))
  }
  return out.join('')
}

/** The whole diagram as a picture (export, thumbnails) */
export function diagramSvg(kind: DiagramKind, m: DiagramModel, c: DiagramColors, pad = 24): string {
  const all = diagramBounds(kind, m)
  const W = Math.ceil(all.w + pad * 2) || 200, H = Math.ceil(all.h + pad * 2) || 120
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Inter, 'Segoe UI', sans-serif"><rect width="100%" height="100%" style="fill:${c.canvas}"/><g transform="translate(${pad - all.x} ${pad - all.y})">${diagramShapes(kind, m, c)}</g></svg>`
}

// ── Use cases ────────────────────────────────────────────────────────────────

/** A use case's surroundings: its actors, what it includes, what extends it */
export function caseLinks(m: DiagramModel, id: string): { actors: string[]; includes: string[]; extendedBy: string[] } {
  const name = (x: string) => m.nodes.find(n => n.id === x)?.name ?? ''
  const actor = (x: string) => m.nodes.find(n => n.id === x)?.type === 'actor'
  return {
    actors: m.edges.filter(e => e.type === 'association' && (e.from === id || e.to === id)).map(e => (e.from === id ? e.to : e.from)).filter(actor).map(name),
    includes: m.edges.filter(e => e.type === 'include' && e.from === id).map(e => name(e.to)),
    extendedBy: m.edges.filter(e => e.type === 'extend' && e.to === id).map(e => name(e.from))
  }
}

// ── The file ─────────────────────────────────────────────────────────────────

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const lines = (v: unknown) => arr(v).map(x => str(x, 200)).slice(0, 200)

/** A diagram read from disk (or sent by the page): only its kind's parts, edges between parts that exist */
export function cleanDiagram(v: unknown, kind: DiagramKind): DiagramModel {
  const d = (v ?? {}) as Record<string, unknown>
  const types = NODE_TYPES[kind]
  const nodes: DiagramNode[] = arr(d.nodes).map(x => {
    const o = (x ?? {}) as Record<string, unknown>
    const type = types.includes(o.type as DiagramNodeType) ? o.type as DiagramNodeType : types[0]
    return {
      id: str(o.id, 40) || uid('n'), type, name: str(o.name, 120), x: num(o.x), y: num(o.y),
      ...(type === 'system' ? { w: Math.max(160, num(o.w) || 420), h: Math.max(120, num(o.h) || 340) } : {}),
      ...(['class', 'interface', 'enum'].includes(type) ? { attributes: lines(o.attributes), ...(type === 'enum' ? {} : { methods: lines(o.methods) }) } : {}),
      ...(type === 'case' && Array.isArray(o.steps) ? { steps: lines(o.steps) } : {})
    }
  })
  const ids = new Set(nodes.map(n => n.id))
  const edgeTypes = EDGE_TYPES[kind]
  const edges: DiagramEdge[] = arr(d.edges).map(x => {
    const o = (x ?? {}) as Record<string, unknown>
    return {
      id: str(o.id, 40) || uid('l'), type: edgeTypes.includes(o.type as DiagramEdgeType) ? o.type as DiagramEdgeType : edgeTypes[0], from: str(o.from, 40), to: str(o.to, 40),
      ...(str(o.label, 120) ? { label: str(o.label, 120) } : {}), ...(kind === 'sequence' ? { y: num(o.y) } : {})
    }
  }).filter(e => ids.has(e.from) && ids.has(e.to))
  const notes: ModelNote[] = arr(d.notes).map(x => { const o = (x ?? {}) as Record<string, unknown>; return { id: str(o.id, 40) || uid('t'), x: num(o.x), y: num(o.y), text: str(o.text, 2000) } })
  return { nodes, edges, notes }
}
