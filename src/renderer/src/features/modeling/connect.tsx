import type { DragEvent as ReactDragEvent, PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@renderer/lib/cn'

/**
 * The links pulled by hand, shared by the modeling canvases: each part shows
 * four points when the pointer is over it; pulling one draws a line that
 * follows the pointer, and letting go on another part links them. The
 * palette's parts are dragged onto the canvas the same way.
 */

interface Box { x: number; y: number; w: number; h: number }
interface Point { x: number; y: number }

export type Side = 'top' | 'right' | 'bottom' | 'left'
const SIDES: Side[] = ['top', 'right', 'bottom', 'left']

export function sidePoint(b: Box, s: Side): Point {
  if (s === 'top') return { x: b.x + b.w / 2, y: b.y }
  if (s === 'bottom') return { x: b.x + b.w / 2, y: b.y + b.h }
  if (s === 'left') return { x: b.x, y: b.y + b.h / 2 }
  return { x: b.x + b.w, y: b.y + b.h / 2 }
}

/** The part under a point (the last drawn wins), a little margin around each */
export function partAt<T extends { id: string; box: Box }>(p: Point, parts: T[], skip?: string): T | null {
  for (let i = parts.length - 1; i >= 0; i--) {
    const { id, box: b } = parts[i]
    if (id !== skip && p.x >= b.x - 10 && p.x <= b.x + b.w + 10 && p.y >= b.y - 10 && p.y <= b.y + b.h + 10) return parts[i]
  }
  return null
}

/**
 * A part's four points, in the canvas's own units but kept the same size on
 * screen whatever the zoom. Put them in the same `group` element as the part,
 * so that going from the part to a point keeps them shown.
 */
export function Handles({ box, k, name, shown, sides = SIDES, onPull }: {
  box: Box; k: number; name: string; shown?: boolean; sides?: Side[]
  onPull: (ev: ReactPointerEvent, from: Point) => void
}) {
  const hit = 22 / k, dot = 11 / k
  return <>
    {sides.map(s => {
      const p = sidePoint(box, s)
      return (
        <div key={s} data-handle={`${name}:${s}`} title={name}
          onPointerDown={ev => { if (ev.button === 0) onPull(ev, p) }}
          className={cn('group/h absolute flex cursor-crosshair items-center justify-center transition-opacity', shown ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}
          style={{ left: p.x - hit / 2, top: p.y - hit / 2, width: hit, height: hit }}>
          <span className="rounded-full border-accent bg-surface group-hover/h:bg-accent" style={{ width: dot, height: dot, borderWidth: 2 / k, borderStyle: 'solid' }} />
        </div>
      )
    })}
  </>
}

/** The line being pulled: dashed while it points at nothing, solid on a part it can link */
export function Wire({ from, to, ok }: { from: Point; to: Point; ok: boolean }) {
  return (
    <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--color-accent)" strokeWidth={2} strokeDasharray={ok ? undefined : '6 4'} />
      <circle cx={to.x} cy={to.y} r={4} fill="var(--color-accent)" />
    </svg>
  )
}

/** The ring around the part a pulled line would link */
export const TARGET_RING = 'shadow-[0_0_0_3px_var(--color-accent)]'

// ── The palette, dragged onto the canvas ─────────────────────────────────────

const PART = 'application/x-devforge-part'

export const dragPart = (type: string) => (ev: ReactDragEvent) => {
  ev.dataTransfer.setData(PART, type)
  ev.dataTransfer.effectAllowed = 'copy'
}

/** The canvas's drop handlers: `onDrop` gets the part's type and where it fell, in client coordinates */
export function dropZone(onDrop: (type: string, clientX: number, clientY: number) => void) {
  return {
    onDragOver: (ev: ReactDragEvent) => { if (ev.dataTransfer.types.includes(PART)) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy' } },
    onDrop: (ev: ReactDragEvent) => {
      const type = ev.dataTransfer.getData(PART)
      if (!type) return
      ev.preventDefault()
      onDrop(type, ev.clientX, ev.clientY)
    }
  }
}
