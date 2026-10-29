import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export interface TabItem<T extends string> { id: T; label: string; count?: number }

/** Room kept for the "More" button */
const MORE_WIDTH = 120

/**
 * v3.8.1: underlined tabs on one line, never a scrollbar: those that do not
 * fit go in a "More" menu; the open tab always stays on the bar.
 */
export default function TabBar<T extends string>({ items, active, onSelect, moreLabel }: {
  items: TabItem<T>[]
  active: T
  onSelect: (id: T) => void
  moreLabel: string
}) {
  const bar = useRef<HTMLDivElement>(null)
  const measure = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [widths, setWidths] = useState<number[]>([])
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = bar.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  // Each tab's width, from an invisible copy of the bar
  const key = items.map(i => `${i.id}:${i.label}:${i.count ?? ''}`).join('|')
  useLayoutEffect(() => {
    const read = () => setWidths([...(measure.current?.children ?? [])].map(c => (c as HTMLElement).offsetWidth + 4))
    read()
    // Measured again once the font is there (the fallback is narrower)
    void document.fonts?.ready.then(read)
  }, [key])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  // As many as fit; the open one swapped in when it would be hidden
  let shown = items
  if (widths.length === items.length && width > 0 && widths.reduce((a, b) => a + b, 0) > width) {
    let used = MORE_WIDTH, n = 0
    while (n < items.length && used + widths[n] <= width) { used += widths[n]; n++ }
    shown = items.slice(0, Math.max(1, n))
    const i = items.findIndex(t => t.id === active)
    if (i >= shown.length) {
      // Room for the open tab: the last ones give theirs
      while (shown.length > 1 && shown.reduce((s, t) => s + widths[items.indexOf(t)], MORE_WIDTH) + widths[i] > width) shown = shown.slice(0, -1)
      shown = [...shown, items[i]]
    }
  }
  const hidden = items.filter(t => !shown.includes(t))

  const tab = (t: TabItem<T>, inMeasure = false) => (
    <button key={t.id} role={inMeasure ? undefined : 'tab'} aria-selected={inMeasure ? undefined : active === t.id} tabIndex={inMeasure ? -1 : undefined}
      onClick={inMeasure ? undefined : () => onSelect(t.id)}
      className={cn('flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-base font-medium whitespace-nowrap transition-colors',
        active === t.id ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg')}>
      {t.label}
      {!!t.count && <span className="rounded-full bg-elevated px-1.5 font-mono text-[10.5px] text-fg-muted">{t.count}</span>}
    </button>
  )

  return (
    <div className="relative">
      {/* The copy is wider than the page: held in a box of no size, so the page never scrolls sideways */}
      <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
        <div ref={measure} className="flex w-max gap-1">{items.map(t => tab(t, true))}</div>
      </div>
      <div ref={bar} className="flex items-end gap-1 border-b border-line">
        <div role="tablist" className="flex min-w-0 gap-1 overflow-hidden">{shown.map(t => tab(t))}</div>
        {hidden.length > 0 && (
          <div ref={menu} className="relative shrink-0">
            <button aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}
              className={cn('flex h-9 items-center gap-1 border-b-2 border-transparent px-3 text-base font-medium whitespace-nowrap', open ? 'text-fg' : 'text-fg-secondary hover:text-fg')}>
              {moreLabel} <span className="rounded-full bg-elevated px-1.5 font-mono text-[10.5px] text-fg-muted">{hidden.length}</span>
              <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
              <div role="menu" aria-label={moreLabel} className="absolute top-10 right-0 z-30 flex min-w-[200px] flex-col rounded-xl border border-line bg-elevated p-1 shadow-pop">
                {hidden.map(t => (
                  <button key={t.id} role="menuitem" onClick={() => { onSelect(t.id); setOpen(false) }}
                    className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg-secondary hover:bg-hover hover:text-fg">
                    {t.label}
                    {!!t.count && <span className="rounded-full bg-canvas px-1.5 font-mono text-[10.5px] text-fg-muted">{t.count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
