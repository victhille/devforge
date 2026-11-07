import type { Box, Point } from './mcd'

/**
 * v4.2 lot 2: the selection lined up, spread out, and where pasted parts go.
 * Shared by the MCD, the diagrams and the MPD; each gets back the new top
 * left corner of the parts that move.
 */

export type AlignHow = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type Axis = 'x' | 'y'

/** The parts lined up on the selection's left edge, its middle, its right edge (or top, middle, bottom) */
export function align(boxes: Map<string, Box>, how: AlignHow): Map<string, Point> {
  const out = new Map<string, Point>()
  if (boxes.size < 2) return out
  const list = [...boxes.values()]
  const left = Math.min(...list.map(b => b.x)), right = Math.max(...list.map(b => b.x + b.w))
  const top = Math.min(...list.map(b => b.y)), bottom = Math.max(...list.map(b => b.y + b.h))
  for (const [id, b] of boxes) {
    const x = how === 'left' ? left : how === 'right' ? right - b.w : how === 'center' ? (left + right - b.w) / 2 : b.x
    const y = how === 'top' ? top : how === 'bottom' ? bottom - b.h : how === 'middle' ? (top + bottom - b.h) / 2 : b.y
    out.set(id, { x: Math.round(x), y: Math.round(y) })
  }
  return out
}

/**
 * The same space between neighbours along an axis (three parts at least):
 * the first and the last stay where they are, the others are spread between.
 */
export function distribute(boxes: Map<string, Box>, axis: Axis): Map<string, Point> {
  const out = new Map<string, Point>()
  if (boxes.size < 3) return out
  const start = (b: Box) => (axis === 'x' ? b.x : b.y)
  const size = (b: Box) => (axis === 'x' ? b.w : b.h)
  const list = [...boxes].sort(([, a], [, b]) => start(a) + size(a) / 2 - (start(b) + size(b) / 2))
  const first = list[0][1], last = list[list.length - 1][1]
  const room = start(last) + size(last) - start(first) - list.reduce((sum, [, b]) => sum + size(b), 0)
  const gap = room / (list.length - 1)
  let at = start(first)
  for (const [id, b] of list) {
    out.set(id, axis === 'x' ? { x: Math.round(at), y: b.y } : { x: b.x, y: Math.round(at) })
    at += size(b) + gap
  }
  return out
}

/**
 * How far pasted parts move from where they were copied: a step aside (one
 * more each time) while that place is on screen, else into the middle of it.
 */
export function pasteShift(copied: Box, seen: Box, times: number): Point {
  const onScreen = copied.x < seen.x + seen.w && seen.x < copied.x + copied.w && copied.y < seen.y + seen.h && seen.y < copied.y + copied.h
  if (onScreen) return { x: 24 * times, y: 24 * times }
  const step = 24 * (times - 1)
  return { x: Math.round(seen.x + seen.w / 2 - (copied.x + copied.w / 2)) + step, y: Math.round(seen.y + seen.h / 2 - (copied.y + copied.h / 2)) + step }
}

/** The parts given a new place (`rowOnly`: they keep their height, as a sequence's participants) */
export function placed<T extends { id: string; x: number; y: number }>(list: T[], to: Map<string, Point>, rowOnly = false): T[] {
  return list.map(n => {
    const p = to.get(n.id)
    return p ? { ...n, x: p.x, y: rowOnly ? n.y : p.y } : n
  })
}
