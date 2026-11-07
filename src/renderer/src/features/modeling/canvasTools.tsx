import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical,
  AlignVerticalDistributeCenter, CopyPlus, Hand, Minus, MousePointer2, Plus, Redo2, Trash2, Undo2
} from 'lucide-react'
import { bounds, type Box, type Point } from '@shared/lib/mcd'
import type { AlignHow, Axis } from '@shared/lib/arrange'
import Button from '@renderer/components/ui/Button'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import { dragPart } from './connect'

/**
 * v4.1: the editors' floating bar, at the bottom of the canvas: the cursor
 * (select a zone, or move the view) and the parts to place. Shared by the
 * MCD, the diagrams and the MPD.
 */

export type CanvasTool = 'select' | 'hand'

export const isTyping = (t: EventTarget | null) => t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement
  || (t instanceof HTMLElement && (t.isContentEditable || t.getAttribute('role') === 'textbox'))

/** A control the Space key works on by itself (a button, a choice…): Space is not taken from it for the hand */
const SPACE_CONTROLS = 'button, a[href], summary, [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="menuitem"], [role="option"]'
const ownsSpace = (t: EventTarget | null) => t instanceof Element && !!t.closest(SPACE_CONTROLS)

/**
 * v4.2: a short message for screen readers, told politely (one live region
 * for the whole window, made the first time; no role, so that it is never
 * mistaken for a page's own status).
 */
export function announce(text: string): void {
  let el = document.getElementById('df-announcer')
  if (!el) {
    el = document.createElement('div')
    el.id = 'df-announcer'
    el.setAttribute('aria-live', 'polite')
    el.setAttribute('aria-atomic', 'true')
    el.className = 'sr-only'
    document.body.appendChild(el)
  }
  // Emptied first, so the same message twice is still read
  el.textContent = ''
  const target = el
  requestAnimationFrame(() => { target.textContent = text })
}

/** v4.2: the focus back on the editor's canvas (after its selection went away with the panel that had it) */
export function focusCanvas(): void {
  document.querySelector<HTMLElement>('[data-canvas]')?.focus({ preventScroll: true })
}

/**
 * A press on the canvas leaves the field being typed in (the canvas keeps the
 * focus from moving), so Delete then removes the part, not a letter.
 */
export function leaveFields(): void {
  const a = document.activeElement
  if (a instanceof HTMLElement && isTyping(a)) a.blur()
}

/** The cursor chosen (kept between editors), V and H to change it, Space held for the hand a moment */
export function useCanvasTool() {
  const [chosen, setTool] = usePersistentState<CanvasTool>('devforge:canvas-tool', 'select')
  const [space, setSpace] = useState(false)
  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (isTyping(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return
      if (ev.code === 'Space') { if (ownsSpace(ev.target)) return; ev.preventDefault(); setSpace(true) }
      else if (ev.key.toLowerCase() === 'v') setTool('select')
      else if (ev.key.toLowerCase() === 'h') setTool('hand')
    }
    const up = (ev: KeyboardEvent) => { if (ev.code === 'Space') setSpace(false) }
    const blur = () => setSpace(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [setTool])
  return { tool: space ? 'hand' as const : chosen, chosen, setTool }
}

/** The canvas cursor for a tool, while nothing else is going on */
export const toolCursor = (tool: CanvasTool) => (tool === 'hand' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default')

/** Boxes that touch */
export const touches = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The box between two points, whichever way it was drawn */
export const boxOf = (a: Point, b: Point): Box => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

/** The zone being drawn, in screen pixels inside the canvas */
export function ZoneRect({ box }: { box: Box | null }) {
  if (!box) return null
  return <div data-testid="select-zone" className="pointer-events-none absolute z-10 rounded-sm border border-accent bg-accent/10" style={{ left: box.x, top: box.y, width: box.w, height: box.h }} />
}

/** The floating bar: the two cursors, then the parts (`children`) */
export function CanvasBar({ tool, onTool, children }: { tool: CanvasTool; onTool: (t: CanvasTool) => void; children?: ReactNode }) {
  const { t } = useI18n()
  const e = t.modeling.editor
  return (
    // Inside the canvas, which takes the pointer and refuses any drag: a part dragged from here must get out
    <div role="toolbar" aria-label={e.palette} onPointerDown={ev => ev.stopPropagation()} onDoubleClick={ev => ev.stopPropagation()} onDragStart={ev => ev.stopPropagation()}
      className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border border-line bg-surface/95 p-1 shadow-pop backdrop-blur [scrollbar-width:none]">
      <div role="radiogroup" aria-label={e.tools.label} className="flex shrink-0 items-center gap-0.5">
        <ToolButton label={`${e.tools.select} (V)`} hint={e.tools.selectHint} checked={tool === 'select'} onClick={() => onTool('select')}><MousePointer2 size={16} /></ToolButton>
        <ToolButton label={`${e.tools.hand} (H)`} hint={e.tools.handHint} checked={tool === 'hand'} onClick={() => onTool('hand')}><Hand size={16} /></ToolButton>
      </div>
      {children && <span className="mx-1 h-7 w-px shrink-0 bg-line" aria-hidden />}
      {children}
    </div>
  )
}

function ToolButton({ label, hint, checked, onClick, children }: { label: string; hint: string; checked: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={checked} aria-label={label} title={`${label} — ${hint}`} onClick={onClick}
      className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', checked ? 'bg-accent text-accent-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
      {children}
    </button>
  )
}

/** A part to place: a click puts it in the middle of the view, a drag where it is let go */
export function BarItem({ label, icon, onClick, drag, pressed, radio }: { label: string; icon: ReactNode; onClick: () => void; drag?: string; pressed?: boolean; radio?: boolean }) {
  return (
    <button type="button" onClick={onClick} role={radio ? 'radio' : undefined} aria-checked={radio ? !!pressed : undefined}
      draggable={!!drag} onDragStart={drag ? dragPart(drag) : undefined} title={label}
      className={cn('flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors', drag && 'cursor-grab active:cursor-grabbing',
        pressed ? 'bg-accent-soft text-fg ring-1 ring-accent' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
      <span className="shrink-0">{icon}</span>{label}
    </button>
  )
}

/** A thin line between groups of the bar */
export const BarSeparator = () => <span className="mx-1 h-7 w-px shrink-0 bg-line" aria-hidden />

// ── v4.2 lot 1: the other pieces the three editors share ─────────────────────

type ViewLike = { x: number; y: number; k: number }

/** The canvas' dotted grid, which follows the view */
export const gridStyle = (view: ViewLike): CSSProperties => ({
  backgroundImage: 'radial-gradient(var(--color-line-subtle) 1px, transparent 1px)',
  backgroundSize: `${20 * view.k}px ${20 * view.k}px`,
  backgroundPosition: `${view.x}px ${view.y}px`
})

/** Saving, saved in conception/…, or failed */
export function SaveStatus({ state, file, className }: { state: 'saved' | 'saving' | 'failed'; file: string; className: string }) {
  const { t } = useI18n()
  const e = t.modeling.editor
  return (
    <span role="status" className={cn(className, state === 'failed' ? 'text-danger' : 'text-fg-muted')}>
      {state === 'saving' ? e.saving : state === 'failed' ? e.saveFailed : e.saved.replace('{file}', `conception/${file}`)}
    </span>
  )
}

export function UndoRedo({ undo, redo, canUndo, canRedo }: { undo: () => void; redo: () => void; canUndo: boolean; canRedo: boolean }) {
  const { t } = useI18n()
  const e = t.modeling.editor
  return <>
    <IconButton size="sm" title={`${e.undo} (Ctrl+Z)`} onClick={undo} disabled={!canUndo}><Undo2 size={14} /></IconButton>
    <IconButton size="sm" title={`${e.redo} (Ctrl+Y)`} onClick={redo} disabled={!canRedo}><Redo2 size={14} /></IconButton>
  </>
}

/** − / the zoom / + */
export function ZoomButtons({ k, zoom }: { k: number; zoom: (factor: number) => void }) {
  const { t } = useI18n()
  const e = t.modeling.editor
  return (
    <span className="flex items-center gap-0.5 rounded-lg border border-line px-0.5">
      <IconButton size="sm" title={e.zoomOut} onClick={() => zoom(1 / 1.2)}><Minus size={14} /></IconButton>
      <span className="w-11 text-center font-mono text-xs text-fg-secondary">{Math.round(k * 100)} %</span>
      <IconButton size="sm" title={e.zoomIn} onClick={() => zoom(1.2)}><Plus size={14} /></IconButton>
    </span>
  )
}

/**
 * v4.2 lot 2: several parts picked: how many, lined up (edges, middles),
 * spread out (three at least), duplicated, removed.
 */
export function SelectionPanel({ count, onAlign, onSpread, onDuplicate, onRemove, rowOnly }: {
  count: number
  onAlign: (how: AlignHow) => void
  onSpread: (axis: Axis) => void
  onDuplicate: () => void
  onRemove: () => void
  /** A sequence's participants: in their row, nothing to line up from top to bottom */
  rowOnly?: boolean
}) {
  const { t } = useI18n()
  const s = t.modeling.editor.selection
  const aligns: [AlignHow, string, ReactNode][] = [
    ['left', s.alignLeft, <AlignStartVertical key="l" size={14} />], ['center', s.alignCenter, <AlignCenterVertical key="c" size={14} />], ['right', s.alignRight, <AlignEndVertical key="r" size={14} />],
    ...(rowOnly ? [] : [['top', s.alignTop, <AlignStartHorizontal key="t" size={14} />], ['middle', s.alignMiddle, <AlignCenterHorizontal key="m" size={14} />], ['bottom', s.alignBottom, <AlignEndHorizontal key="b" size={14} />]] as [AlignHow, string, ReactNode][])
  ]
  const few = count < 3
  return <>
    <p className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{s.title}</p>
    <p className="text-sm font-medium text-fg" role="status">{s.count.replace('{n}', String(count))}</p>
    <div className="flex flex-wrap items-center gap-1">
      <div role="group" aria-label={s.align} className="flex items-center gap-0.5 rounded-lg border border-line p-0.5">
        {aligns.map(([how, label, icon]) => <IconButton key={how} size="sm" title={label} onClick={() => onAlign(how)}>{icon}</IconButton>)}
      </div>
      <div role="group" aria-label={s.spread} className="flex items-center gap-0.5 rounded-lg border border-line p-0.5">
        <IconButton size="sm" title={few ? `${s.spreadX} — ${s.spreadHint}` : s.spreadX} aria-label={s.spreadX} disabled={few} onClick={() => onSpread('x')}><AlignHorizontalDistributeCenter size={14} /></IconButton>
        {!rowOnly && <IconButton size="sm" title={few ? `${s.spreadY} — ${s.spreadHint}` : s.spreadY} aria-label={s.spreadY} disabled={few} onClick={() => onSpread('y')}><AlignVerticalDistributeCenter size={14} /></IconButton>}
      </div>
    </div>
    <p className="text-xs leading-snug text-fg-muted">{s.hint}</p>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={onDuplicate} title={`${s.duplicate} (Ctrl+D)`}><CopyPlus size={13} /> {s.duplicate}</Button>
      <Button size="sm" variant="danger" onClick={() => { onRemove(); announce(s.removed); focusCanvas() }}><Trash2 size={13} /> {s.remove}</Button>
    </div>
  </>
}

const MINI = { w: 180, h: 110 }

/** The minimap: every part, and the part of the canvas on screen; a press goes there */
export function Minimap({ parts, all, view, size, lit, tone, onGo }: {
  parts: Map<string, Box>; all: Box; view: ViewLike; size: { w: number; h: number }
  /** Picked: drawn in the accent color */
  lit: (id: string) => boolean
  tone: { fill: string; opacity: number }
  onGo: (p: Point) => void
}) {
  const { t } = useI18n()
  if (!parts.size) return null
  const seen = { x: -view.x / view.k, y: -view.y / view.k, w: size.w / view.k, h: size.h / view.k }
  const world = bounds([all.w ? all : seen, seen])
  const mini = world.w ? Math.min((MINI.w - 12) / world.w, (MINI.h - 12) / world.h) : 1
  const toMini = (p: Point) => ({ x: 6 + (p.x - world.x) * mini, y: 6 + (p.y - world.y) * mini })
  const frame = toMini(seen)
  return (
    <svg width={MINI.w} height={MINI.h} role="img" aria-label={t.modeling.editor.minimap}
      className="absolute right-3 bottom-[60px] cursor-pointer rounded-lg border border-line bg-surface/90"
      onPointerDown={ev => {
        ev.stopPropagation()
        const r = ev.currentTarget.getBoundingClientRect()
        onGo({ x: world.x + (ev.clientX - r.left - 6) / mini, y: world.y + (ev.clientY - r.top - 6) / mini })
      }}>
      {[...parts].map(([id, b]) => { const p = toMini(b); return <rect key={id} x={p.x} y={p.y} width={Math.max(2, b.w * mini)} height={Math.max(2, b.h * mini)} rx={1.5} fill={lit(id) ? 'var(--color-accent)' : tone.fill} opacity={tone.opacity} /> })}
      <rect x={frame.x} y={frame.y} width={seen.w * mini} height={seen.h * mini} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />
    </svg>
  )
}
