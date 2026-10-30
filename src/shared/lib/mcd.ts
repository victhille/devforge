import type { Cardinality, McdAssociation, McdAttribute, McdEntity, McdLink, McdModel, McdType, ModelFile, ModelKind, ModelNote } from '../types/modeling'

/** v3.9 lot 2: the MCD (Merise) — sizes, the lines between boxes, the checks, the SVG drawing, the file */

export interface Point { x: number; y: number }
export interface Box extends Point { w: number; h: number }

export const MCD_TYPES: McdType[] = ['int', 'decimal', 'varchar', 'text', 'bool', 'date', 'datetime', 'time', 'uuid', 'json']
export const CARDINALITIES: Cardinality[] = ['0,1', '1,1', '0,n', '1,n']
export const MODEL_KINDS: ModelKind[] = ['mcd', 'mpd', 'usecase', 'class', 'sequence', 'flow', 'architecture']

export const HEADER = 30
export const ROW = 20
const CHAR = 7.4
export const NOTE_W = 180

/** A click on a leg: the next cardinality */
export const nextCard = (c: Cardinality): Cardinality => CARDINALITIES[(CARDINALITIES.indexOf(c) + 1) % CARDINALITIES.length]

export const emptyMcd = (): McdModel => ({ entities: [], associations: [], links: [], notes: [] })

/** Short, unique enough ids for a model's parts */
export const uid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

// ── Sizes and lines ──────────────────────────────────────────────────────────

export function entityBox(e: McdEntity): Box {
  const longest = Math.max(e.name.length, ...e.attributes.map(a => a.name.length), 6)
  return { x: e.x, y: e.y, w: Math.max(150, Math.round(longest * CHAR + 28)), h: HEADER + Math.max(1, e.attributes.length) * ROW + 10 }
}

export function associationBox(a: McdAssociation): Box {
  const longest = Math.max(a.name.length, ...a.attributes.map(x => x.name.length), 4)
  return { x: a.x, y: a.y, w: Math.max(116, Math.round(longest * CHAR + 44)), h: 44 + a.attributes.length * 16 }
}

export function noteBox(n: ModelNote): Box {
  return { x: n.x, y: n.y, w: NOTE_W, h: 18 + Math.max(1, wrap(n.text, 24).length) * 17 }
}

export function bounds(boxes: Box[]): Box {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 }
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y))
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y }
}

export const center = (b: Box): Point => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })

/** Where the line from the box's center towards p leaves the box (a rectangle, or the ellipse of an association) */
export function edgePoint(b: Box, p: Point, round = false): Point {
  const c = center(b)
  const dx = p.x - c.x, dy = p.y - c.y
  if (!dx && !dy) return c
  if (round) {
    const rx = b.w / 2, ry = b.h / 2
    const t = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry))
    return { x: c.x + dx * t, y: c.y + dy * t }
  }
  const t = Math.min(dx ? (b.w / 2) / Math.abs(dx) : Infinity, dy ? (b.h / 2) / Math.abs(dy) : Infinity)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

/** A leg: from the entity's edge to the association's, and where its cardinality is written (near the entity) */
export function legLine(entity: Box, association: Box): { from: Point; to: Point; label: Point } {
  const from = edgePoint(entity, center(association))
  const to = edgePoint(association, center(entity), true)
  const len = Math.hypot(to.x - from.x, to.y - from.y) || 1
  const ux = (to.x - from.x) / len, uy = (to.y - from.y) / len
  // A little along the line, a little to its side, clear of the line itself
  const along = Math.min(22, len / 3)
  return { from, to, label: { x: from.x + ux * along - uy * 17, y: from.y + uy * along + ux * 17 } }
}

// ── Checks ───────────────────────────────────────────────────────────────────

export type McdIssueCode = 'noIdentifier' | 'noName' | 'sameName' | 'noType' | 'lonelyAssociation' | 'lonelyEntity'
export interface McdIssue {
  level: 'error' | 'warning'
  code: McdIssueCode
  /** The entity or association it is about */
  target: string
  /** The name shown in the message (the attribute's, for noType) */
  name: string
}

/** What would stop the MLD, or is worth a look: each entity has an identifier, a name, its attributes a type… */
export function checkMcd(m: McdModel): McdIssue[] {
  const out: McdIssue[] = []
  const seen = new Map<string, string>()
  const named = [...m.entities.map(e => ({ ...e, isEntity: true })), ...m.associations.map(a => ({ ...a, isEntity: false }))]
  for (const n of named) {
    const name = n.name.trim()
    if (!name) { out.push({ level: 'error', code: 'noName', target: n.id, name: '' }); continue }
    const key = name.toLowerCase()
    if (seen.has(key)) out.push({ level: 'error', code: 'sameName', target: n.id, name })
    else seen.set(key, n.id)
    if (n.isEntity && !n.attributes.some(a => a.identifier)) out.push({ level: 'error', code: 'noIdentifier', target: n.id, name })
    for (const a of n.attributes) if (!a.type) out.push({ level: 'warning', code: 'noType', target: n.id, name: `${name}.${a.name}` })
  }
  for (const a of m.associations) {
    if (m.links.filter(l => l.association === a.id).length < 2) out.push({ level: 'warning', code: 'lonelyAssociation', target: a.id, name: a.name })
  }
  for (const e of m.entities) {
    if (m.entities.length > 1 && !m.links.some(l => l.entity === e.id)) out.push({ level: 'warning', code: 'lonelyEntity', target: e.id, name: e.name })
  }
  return out
}

// ── The file ─────────────────────────────────────────────────────────────────

/** "Boutique en ligne" → "boutique-en-ligne.mcd.json" */
export function modelFileName(name: string, kind: ModelKind): string {
  const slug = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'modele'
  return `${slug}.${kind}.json`
}

/** A model file name DevForge reads: no folder, no "..", one of its kinds */
export const MODEL_FILE_RE = /^[a-z0-9][a-z0-9-]{0,59}\.(mcd|mpd|usecase|class|sequence|flow|architecture)\.json$/

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

function cleanAttribute(v: unknown): McdAttribute {
  const a = (v ?? {}) as Record<string, unknown>
  const type = MCD_TYPES.includes(a.type as McdType) ? a.type as McdType : ''
  return {
    id: str(a.id, 40) || uid('a'), name: str(a.name, 80), type,
    ...(typeof a.length === 'number' && a.length > 0 ? { length: Math.min(65535, Math.round(a.length)) } : {}),
    ...(a.identifier ? { identifier: true } : {})
  }
}

/** A model read from disk (or sent by the page), with every part in its expected shape; links to nothing are dropped */
export function cleanMcd(v: unknown): McdModel {
  const m = (v ?? {}) as Record<string, unknown>
  const node = (x: unknown) => { const o = (x ?? {}) as Record<string, unknown>; return { id: str(o.id, 40) || uid('n'), name: str(o.name, 80), x: num(o.x), y: num(o.y), attributes: arr(o.attributes).map(cleanAttribute) } }
  const entities = arr(m.entities).map(node)
  const associations = arr(m.associations).map(node)
  const ids = new Set([...entities, ...associations].map(n => n.id))
  const links: McdLink[] = arr(m.links).map(x => {
    const o = (x ?? {}) as Record<string, unknown>
    return { id: str(o.id, 40) || uid('l'), entity: str(o.entity, 40), association: str(o.association, 40), card: CARDINALITIES.includes(o.card as Cardinality) ? o.card as Cardinality : '0,n' }
  }).filter(l => ids.has(l.entity) && ids.has(l.association))
  const notes: ModelNote[] = arr(m.notes).map(x => { const o = (x ?? {}) as Record<string, unknown>; return { id: str(o.id, 40) || uid('t'), x: num(o.x), y: num(o.y), text: str(o.text, 2000) } })
  return { entities, associations, links, notes }
}

export function cleanModelFile(v: unknown): ModelFile {
  const f = (v ?? {}) as Record<string, unknown>
  const kind = MODEL_KINDS.includes(f.kind as ModelKind) ? f.kind as ModelKind : 'mcd'
  return {
    v: 1, kind, name: str(f.name, 120) || 'Modèle', updatedAt: str(f.updatedAt, 40) || new Date().toISOString(),
    ...(kind === 'mcd' ? { mcd: cleanMcd(f.mcd) } : {})
  }
}

// ── Drawing ──────────────────────────────────────────────────────────────────

export interface McdColors { canvas: string; card: string; line: string; entity: string; text: string; muted: string; card11: string; note: string; noteText: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The whole MCD as an SVG (export, thumbnails), the same layout as the editor */
export function mcdSvg(m: McdModel, c: McdColors, pad = 24): string {
  const eb = new Map(m.entities.map(e => [e.id, entityBox(e)]))
  const ab = new Map(m.associations.map(a => [a.id, associationBox(a)]))
  const all = bounds([...eb.values(), ...ab.values(), ...m.notes.map(noteBox)])
  const W = Math.ceil(all.w + pad * 2) || 200, H = Math.ceil(all.h + pad * 2) || 120
  const ox = pad - all.x, oy = pad - all.y
  const font = "font-family=\"Consolas, 'Geist Mono', monospace\""
  const out: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="${c.canvas}"/><g transform="translate(${ox} ${oy})" ${font}>`]
  for (const l of m.links) {
    const e = eb.get(l.entity), a = ab.get(l.association)
    if (!e || !a) continue
    const p = legLine(e, a)
    out.push(`<line x1="${p.from.x}" y1="${p.from.y}" x2="${p.to.x}" y2="${p.to.y}" stroke="${c.line}" stroke-width="1.5"/>`)
    out.push(`<text x="${p.label.x}" y="${p.label.y + 4}" text-anchor="middle" font-size="12" font-weight="600" fill="${c.card11}">${l.card}</text>`)
  }
  for (const e of m.entities) {
    const b = eb.get(e.id)!
    out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${c.card}" stroke="${c.entity}" stroke-width="1.5"/>`)
    out.push(`<line x1="${b.x}" y1="${b.y + HEADER}" x2="${b.x + b.w}" y2="${b.y + HEADER}" stroke="${c.entity}" stroke-width="1.5"/>`)
    out.push(`<text x="${b.x + b.w / 2}" y="${b.y + 20}" text-anchor="middle" font-size="13" font-weight="700" fill="${c.text}">${esc(e.name.toUpperCase())}</text>`)
    e.attributes.forEach((a, i) => out.push(`<text x="${b.x + 12}" y="${b.y + HEADER + 18 + i * ROW}" font-size="12" fill="${c.text}"${a.identifier ? ' text-decoration="underline"' : ''}>${esc(a.name)}</text>`))
  }
  for (const a of m.associations) {
    const b = ab.get(a.id)!, mid = center(b)
    out.push(`<ellipse cx="${mid.x}" cy="${mid.y}" rx="${b.w / 2}" ry="${b.h / 2}" fill="${c.card}" stroke="${c.entity}" stroke-width="1.5"/>`)
    const top = mid.y - (a.attributes.length * 16) / 2
    out.push(`<text x="${mid.x}" y="${top + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="${c.text}">${esc(a.name.toUpperCase())}</text>`)
    a.attributes.forEach((x, i) => out.push(`<text x="${mid.x}" y="${top + 20 + i * 16}" text-anchor="middle" font-size="11" fill="${c.muted}">${esc(x.name)}</text>`))
  }
  for (const n of m.notes) {
    const b = noteBox(n)
    out.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${c.note}"/>`)
    wrap(n.text, 24).forEach((line, i) => out.push(`<text x="${b.x + 10}" y="${b.y + 20 + i * 17}" font-size="12" font-family="sans-serif" fill="${c.noteText}">${esc(line)}</text>`))
  }
  out.push('</g></svg>')
  return out.join('')
}

/** A note's text in lines of about n characters, by words */
export function wrap(text: string, n: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (line && (line + ' ' + word).length > n) { out.push(line); line = word } else line = line ? `${line} ${word}` : word
    }
    out.push(line)
  }
  return out
}
