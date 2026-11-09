import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import IconButton from './IconButton'

export interface MoreItem { label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }

/**
 * The « ⋯ » of a page header or a table row: the less frequent actions in a menu.
 * Opens on the first item; arrows move, Escape closes and gives the focus back.
 * The menu is placed on the window (fixed, on the document itself), so a table
 * that scrolls, a card that clips its corners or a header that rises as it
 * appears never cuts or covers it; it opens upwards near the bottom.
 */
export default function MoreMenu({ label, items, size = 'md' }: { label: string; items: MoreItem[]; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false)
  const [place, setPlace] = useState<CSSProperties>({})
  // Out of the page, it keeps the scale of the page it opens from
  const [mockup, setMockup] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // Where the button was when the menu was placed beside it
  const anchor = useRef<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!open || !button.current) return
    setMockup(!!button.current.closest('.df-mockup'))
    const r = button.current.getBoundingClientRect()
    anchor.current = r
    const height = menu.current?.offsetHeight ?? 0
    const below = r.bottom + 6 + height <= window.innerHeight - 8
    setPlace({ right: Math.max(8, window.innerWidth - r.right), ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) })
  }, [open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    const close = (e: MouseEvent) => {
      const at = e.target as Node
      if (!box.current?.contains(at) && !menu.current?.contains(at)) setOpen(false)
    }
    // A scroll or a resize would leave it away from its button: it closes. Only a scroll that moved the button:
    // a log scrolling to its end elsewhere, or the late event of the scroll that brought the button into view
    // before the click (it arrives once the menu is open), leaves it open
    const away = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return
      if (e.type === 'scroll') {
        const now = button.current?.getBoundingClientRect()
        const was = anchor.current
        if (now && was && Math.abs(now.top - was.top) < 1 && Math.abs(now.left - was.left) < 1) return
      }
      if (menu.current?.contains(document.activeElement)) button.current?.focus()
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('scroll', away, true)
    window.addEventListener('resize', away)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', away, true)
      window.removeEventListener('resize', away)
    }
  }, [open])

  const onKey = (e: ReactKeyboardEvent) => {
    const list = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); button.current?.focus() }
    // Tab leaves the menu: it closes, the focus moves on from its button (the menu sits at the document's end)
    else if (e.key === 'Tab') { setOpen(false); button.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
  }

  return (
    <div ref={box} className="relative" onKeyDown={open ? onKey : undefined}>
      <IconButton ref={button} size={size} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <MoreHorizontal size={size === 'sm' ? 14 : 16} />
      </IconButton>
      {/* Keys pressed in it still reach the box above: React events follow the components, not the document */}
      {open && createPortal(
        <div ref={menu} role="menu" aria-label={label} style={{ position: 'fixed', ...place }}
          className={cn('z-50 flex min-w-[220px] flex-col rounded-xl border border-line bg-surface p-1 text-left shadow-pop', mockup && 'df-mockup', !('top' in place || 'bottom' in place) && 'invisible')}>
          {items.map((it, i) => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); button.current?.focus(); it.onSelect() }}
              className={cn('flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm whitespace-nowrap transition-colors',
                // The first destructive action is set apart from the others
                it.danger && i > 0 && !items[i - 1].danger && 'mt-1 border-t border-line-subtle',
                it.danger ? 'text-danger hover:bg-danger-soft' : 'text-fg-secondary hover:bg-elevated hover:text-fg')}>
              <it.icon size={14} aria-hidden className="shrink-0" /> {it.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
