import type { DbDiagramLink, DbDiagramTable, DbTableRef } from '../types/database'

/**
 * v3.8 lot 4: the schema's layout. Tables as cards of known size; the ones
 * pointed at (parents) on the left, those that point at them to the right,
 * each column ordered by its neighbours' places so arrows cross little.
 */

export interface Point { x: number; y: number }
export interface Box extends Point { w: number; h: number }

export const HEADER = 34
export const ROW = 22
const PAD = 8
const CHAR = 6.7
const COL_GAP = 130
const ROW_GAP = 36

export const tableKey = (t: DbTableRef) => `${t.schema}.${t.name}`

/** A card's size: its header, one row per column, its widest line */
export function boxSize(t: DbDiagramTable): { w: number; h: number } {
  const widest = Math.max(t.name.length + 4, ...t.columns.map(c => c.name.length + c.type.length + 3))
  return { w: Math.round(Math.min(340, Math.max(190, widest * CHAR + 44))), h: HEADER + t.columns.length * ROW + PAD }
}

/** The tables linked to these, these included */
export function withNeighbours(keys: Iterable<string>, links: DbDiagramLink[]): Set<string> {
  const out = new Set(keys)
  const base = new Set(out)
  for (const l of links) {
    const a = tableKey(l.from), b = tableKey(l.to)
    if (base.has(a)) out.add(b)
    if (base.has(b)) out.add(a)
  }
  return out
}

/** The links between shown tables, a table's own (self) links included */
export const shownLinks = (links: DbDiagramLink[], shown: Set<string>) => links.filter(l => shown.has(tableKey(l.from)) && shown.has(tableKey(l.to)))

/** Every table placed: connected groups first (biggest first), lone tables in a grid below */
export function autoLayout(tables: DbDiagramTable[], links: DbDiagramLink[]): Record<string, Point> {
  const keys = tables.map(tableKey)
  const size = new Map(tables.map(t => [tableKey(t), boxSize(t)]))
  const parents = new Map<string, Set<string>>(keys.map(k => [k, new Set()]))
  const around = new Map<string, Set<string>>(keys.map(k => [k, new Set()]))
  for (const l of links) {
    const a = tableKey(l.from), b = tableKey(l.to)
    if (a === b || !around.has(a) || !around.has(b)) continue
    parents.get(a)!.add(b)
    around.get(a)!.add(b)
    around.get(b)!.add(a)
  }

  // Connected groups
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const k of [...keys].sort()) {
    if (seen.has(k)) continue
    const group: string[] = []
    const queue = [k]
    seen.add(k)
    while (queue.length) {
      const cur = queue.shift()!
      group.push(cur)
      for (const n of [...around.get(cur)!].sort()) if (!seen.has(n)) { seen.add(n); queue.push(n) }
    }
    groups.push(group)
  }
  const linked = groups.filter(g => g.length > 1).sort((a, b) => b.length - a.length)
  const alone = groups.filter(g => g.length === 1).map(g => g[0])

  // A table's column: the longest chain of parents above it (cycles cut)
  const depth = new Map<string, number>()
  const visiting = new Set<string>()
  const level = (k: string): number => {
    if (depth.has(k)) return depth.get(k)!
    if (visiting.has(k)) return 0
    visiting.add(k)
    let d = 0
    for (const p of parents.get(k)!) d = Math.max(d, level(p) + 1)
    visiting.delete(k)
    depth.set(k, d)
    return d
  }

  const out: Record<string, Point> = {}
  let top = 0
  for (const group of linked) {
    const columns: string[][] = []
    for (const k of group) (columns[level(k)] ??= []).push(k)
    const cols = columns.filter(Boolean)
    // Barycenter sweeps, right then left
    const index = new Map<string, number>()
    const reindex = () => cols.forEach(c => c.forEach((k, i) => index.set(k, i)))
    reindex()
    const bary = (k: string, side: Set<string>) => {
      const ns = [...around.get(k)!].filter(n => side.has(n))
      return ns.length ? ns.reduce((s, n) => s + index.get(n)!, 0) / ns.length : index.get(k)!
    }
    for (let pass = 0; pass < 6; pass++) {
      const order = pass % 2 === 0 ? cols.map((_, i) => i).slice(1) : cols.map((_, i) => i).slice(0, -1).reverse()
      for (const i of order) {
        const side = new Set(cols[pass % 2 === 0 ? i - 1 : i + 1])
        const b = new Map(cols[i].map(k => [k, bary(k, side)]))
        cols[i].sort((p, q) => b.get(p)! - b.get(q)! || p.localeCompare(q))
        reindex()
      }
    }
    // Columns side by side, each centred on the tallest
    const heights = cols.map(c => c.reduce((s, k) => s + size.get(k)!.h, 0) + (c.length - 1) * ROW_GAP)
    const tallest = Math.max(...heights)
    let x = 0
    cols.forEach((c, i) => {
      let y = top + (tallest - heights[i]) / 2
      for (const k of c) { out[k] = { x, y }; y += size.get(k)!.h + ROW_GAP }
      x += Math.max(...c.map(k => size.get(k)!.w)) + COL_GAP
    })
    // Each card drawn towards its neighbours' height (straighter arrows), the column's order kept
    const middle = (k: string) => out[k].y + size.get(k)!.h / 2
    for (let pass = 0; pass < 2; pass++) {
      for (const c of pass % 2 === 0 ? cols : [...cols].reverse()) {
        const want = c.map(k => {
          const ns = [...around.get(k)!].filter(n => !c.includes(n))
          // Halfway: straighter arrows, the schema kept compact
          return ns.length ? (out[k].y + ns.reduce((sum, n) => sum + middle(n), 0) / ns.length - size.get(k)!.h / 2) / 2 : out[k].y
        })
        const ys: number[] = []
        c.forEach((k, j) => { ys.push(j ? Math.max(want[j], ys[j - 1] + size.get(c[j - 1])!.h + ROW_GAP) : want[j]) })
        // Pushed down only: the column goes back up by the mean push
        const up = ys.reduce((sum, y, j) => sum + (y - want[j]), 0) / c.length
        c.forEach((k, j) => { out[k].y = ys[j] - up })
      }
    }
    const groupTop = Math.min(...group.map(k => out[k].y))
    for (const k of group) out[k] = { x: out[k].x, y: Math.round(out[k].y - groupTop + top) }
    top = Math.max(...group.map(k => out[k].y + size.get(k)!.h)) + ROW_GAP * 3
  }

  // Lone tables, five per row
  const PER_ROW = 5
  for (let r = 0; r * PER_ROW < alone.length; r++) {
    const row = alone.slice(r * PER_ROW, (r + 1) * PER_ROW)
    let x = 0
    for (const k of row) { out[k] = { x, y: top }; x += size.get(k)!.w + ROW_GAP * 1.5 }
    top += Math.max(...row.map(k => size.get(k)!.h)) + ROW_GAP * 1.5
  }
  return out
}

/** The tables' bounding box (0 0 0 0 when none) */
export function bounds(boxes: Box[]): Box {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 }
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y))
  return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y }
}

/** The y of a column's row in its card (the header when the column is not found) */
const rowY = (b: Box, t: DbDiagramTable, column: string | undefined) => {
  const i = column ? t.columns.findIndex(c => c.name === column) : -1
  return i < 0 ? b.y + HEADER / 2 : b.y + HEADER + i * ROW + ROW / 2
}

/**
 * A link's curve, from the column that points (in the child) to the column
 * pointed at (in the parent), leaving and entering by the facing sides.
 */
export function linkPath(from: Box, fromTable: DbDiagramTable, to: Box, toTable: DbDiagramTable, link: DbDiagramLink): { d: string; end: Point; toRight: boolean } {
  const y1 = rowY(from, fromTable, link.columns[0])
  const y2 = rowY(to, toTable, link.refColumns[0])
  if (from === to || tableKey(link.from) === tableKey(link.to)) {
    // Self link: a loop on the right side
    const x = from.x + from.w
    return { d: `M ${x} ${y1} C ${x + 50} ${y1}, ${x + 50} ${y2}, ${x} ${y2}`, end: { x, y: y2 }, toRight: false }
  }
  const leftOfIt = to.x + to.w <= from.x
  const rightOfIt = to.x >= from.x + from.w
  if (!leftOfIt && !rightOfIt) {
    // Same column: out and back in by the right
    const x1 = from.x + from.w, x2 = to.x + to.w
    const out = Math.max(x1, x2) + 50
    return { d: `M ${x1} ${y1} C ${out} ${y1}, ${out} ${y2}, ${x2} ${y2}`, end: { x: x2, y: y2 }, toRight: false }
  }
  const x1 = leftOfIt ? from.x : from.x + from.w
  const x2 = leftOfIt ? to.x + to.w : to.x
  const bend = Math.max(40, Math.abs(x2 - x1) / 2)
  const c1 = leftOfIt ? x1 - bend : x1 + bend
  const c2 = leftOfIt ? x2 + bend : x2 - bend
  return { d: `M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`, end: { x: x2, y: y2 }, toRight: !leftOfIt }
}

/** An arrow head at a link's end, pointing into the card */
export function arrowHead(end: Point, toRight: boolean): string {
  const s = toRight ? -1 : 1
  return `M ${end.x} ${end.y} L ${end.x + 8 * s} ${end.y - 4.5} L ${end.x + 8 * s} ${end.y + 4.5} Z`
}

export interface SvgColors { canvas: string; card: string; header: string; line: string; text: string; muted: string; key: string; link: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** The schema as a standalone SVG, for the export */
export function diagramSvg(tables: DbDiagramTable[], positions: Record<string, Point>, links: DbDiagramLink[], c: SvgColors): string {
  const boxes = new Map(tables.filter(t => positions[tableKey(t)]).map(t => [tableKey(t), { ...positions[tableKey(t)], ...boxSize(t) }]))
  const byKey = new Map(tables.map(t => [tableKey(t), t]))
  const all = bounds([...boxes.values()])
  const m = 30
  const vb = `${all.x - m} ${all.y - m} ${all.w + m * 2 + 50} ${all.h + m * 2}`
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${Math.ceil(all.w + m * 2 + 50)}" height="${Math.ceil(all.h + m * 2)}" font-family="Geist Mono, Consolas, monospace">`,
    `<rect x="${all.x - m}" y="${all.y - m}" width="${all.w + m * 2 + 50}" height="${all.h + m * 2}" fill="${c.canvas}"/>`
  ]
  for (const l of links) {
    const a = boxes.get(tableKey(l.from)), b = boxes.get(tableKey(l.to))
    if (!a || !b) continue
    const p = linkPath(a, byKey.get(tableKey(l.from))!, b, byKey.get(tableKey(l.to))!, l)
    parts.push(`<path d="${p.d}" fill="none" stroke="${c.link}" stroke-width="1.5"/>`, `<path d="${arrowHead(p.end, p.toRight)}" fill="${c.link}"/>`)
  }
  for (const [k, b] of boxes) {
    const t = byKey.get(k)!
    parts.push(
      `<g><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${c.card}" stroke="${c.line}"/>`,
      `<path d="M ${b.x} ${b.y + HEADER} H ${b.x + b.w}" stroke="${c.line}"/>`,
      `<text x="${b.x + 12}" y="${b.y + 22}" font-size="13" font-weight="600" fill="${c.text}">${esc(t.name)}</text>`
    )
    t.columns.forEach((col, i) => {
      const y = b.y + HEADER + i * ROW + 15
      parts.push(
        `<text x="${b.x + 12}" y="${y}" font-size="11.5" fill="${col.pk ? c.key : c.text}">${col.pk ? '🔑 ' : ''}${esc(col.name)}</text>`,
        `<text x="${b.x + b.w - 12}" y="${y}" font-size="11" text-anchor="end" fill="${c.muted}">${esc(col.type)}${col.nullable ? '' : ' !'}</text>`
      )
    })
    parts.push('</g>')
  }
  parts.push('</svg>')
  return parts.join('\n')
}
