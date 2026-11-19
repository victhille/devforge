import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { Check, GripVertical, Maximize2, Minimize2, RotateCcw, X } from 'lucide-react'
import type { HomeWidget, WidgetId } from '@shared/types'
import { WIDGET_IDS, type MasonryPlace } from '@shared/lib/homeWidgets'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'

export const move = (list: HomeWidget[], from: number, to: number): HomeWidget[] => {
  if (to < 0 || to >= list.length || from === to) return list
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/** A widget; while customizing: drag it (or Alt + ↑ ↓ on its handle), widen it, remove it */
export function WidgetFrame({
  widget,
  index,
  count,
  editing,
  dragging,
  place,
  onHeight,
  children,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onResize,
  onRemove
}: {
  widget: HomeWidget
  index: number
  count: number
  editing: boolean
  dragging: boolean
  children: ReactNode
  /** Its spot in the masonry; none on a narrow window (one column) */
  place: MasonryPlace | null
  onHeight: (height: number) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDrop: () => void
  onMove: (to: number) => void
  onResize: () => void
  onRemove: () => void
}) {
  const { t } = useI18n()
  const w = t.home.widgets
  const name = w.names[widget.id]
  // Its own height, for the masonry: cards change size as their data arrives
  const box = useRef<HTMLDivElement>(null)
  const report = useRef(onHeight)
  report.current = onHeight
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => report.current(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const onKey = (e: ReactKeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = index + (e.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= count) return
    onMove(to)
    // Focus follows the moved widget
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('[data-widget-grip]')[to]?.focus())
  }
  return (
    <div
      ref={box}
      data-widget={widget.id}
      style={place ? { gridColumn: place.column === 'both' ? '1 / -1' : place.column, gridRow: `${place.row} / span ${place.span}` } : undefined}
      className={cn(
        'relative min-w-0 self-start',
        editing && 'rounded-[16px] outline-2 outline-offset-2 outline-line outline-dashed',
        dragging && 'opacity-40'
      )}
      draggable={editing}
      onDragStart={e => {
        onDragStart()
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragEnd={onDragEnd}
      onDragOver={e => {
        if (editing) e.preventDefault()
      }}
      onDrop={e => {
        e.preventDefault()
        onDrop()
      }}
    >
      <div className={cn(editing && 'pointer-events-none select-none')} aria-hidden={editing || undefined}>
        {children}
      </div>
      {editing && (
        <div className="absolute -top-4 right-4 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-elevated p-0.5 shadow-pop">
          <button
            type="button"
            data-widget-grip
            title={w.move}
            aria-label={`${name} — ${w.move}`}
            onKeyDown={onKey}
            className="flex size-7 cursor-grab items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
          >
            <GripVertical size={14} />
          </button>
          <button
            type="button"
            onClick={onResize}
            title={widget.size === 'full' ? w.narrow : w.widen}
            aria-label={`${name} — ${widget.size === 'full' ? w.narrow : w.widen}`}
            className="hidden size-7 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg md:flex"
          >
            {widget.size === 'full' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            title={w.remove.replace('{name}', name)}
            aria-label={w.remove.replace('{name}', name)}
            className="flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-danger-soft hover:text-danger"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/** While customizing: add a widget, back to the defaults, done */
export function WidgetBar({
  widgets,
  onAdd,
  onReset,
  onDone
}: {
  widgets: HomeWidget[]
  onAdd: (id: WidgetId) => void
  onReset: () => void
  onDone: () => void
}) {
  const { t } = useI18n()
  const w = t.home.widgets
  const missing = WIDGET_IDS.filter(id => !widgets.some(x => x.id === id))
  return (
    <Card className="df-rise flex flex-wrap items-center gap-3 rounded-card border-accent/30 p-3.5">
      <p className="min-w-[220px] flex-1 text-base text-fg-secondary">{w.hint}</p>
      <label className="flex items-center">
        <span className="sr-only">{w.add}</span>
        <select
          value=""
          disabled={!missing.length}
          onChange={e => {
            if (e.target.value) onAdd(e.target.value as WidgetId)
          }}
          className="h-9 rounded-control border border-line-strong bg-surface px-3 text-sm text-fg outline-none focus-visible:border-accent disabled:opacity-50"
        >
          <option value="">{missing.length ? `+ ${w.add}` : w.allShown}</option>
          {missing.map(id => (
            <option key={id} value={id}>
              {w.names[id]}
            </option>
          ))}
        </select>
      </label>
      <Button variant="ghost" onClick={onReset}>
        <RotateCcw size={14} /> {w.reset}
      </Button>
      <Button onClick={onDone}>
        <Check size={14} /> {w.done}
      </Button>
    </Card>
  )
}
