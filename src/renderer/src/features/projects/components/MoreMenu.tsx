import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'

export interface MoreItem { label: string; icon: LucideIcon; danger?: boolean; onSelect: () => void }

/**
 * The « ⋯ » of a page header: the less frequent actions in a menu.
 * Opens on the first item; arrows move, Escape closes and gives the focus back.
 */
export default function MoreMenu({ label, items }: { label: string; items: MoreItem[] }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const onKey = (e: ReactKeyboardEvent) => {
    const list = [...(box.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const i = list.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); button.current?.focus() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length]?.focus() }
  }

  return (
    <div ref={box} className="relative" onKeyDown={open ? onKey : undefined}>
      <IconButton ref={button} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        <MoreHorizontal size={16} />
      </IconButton>
      {open && (
        <div role="menu" aria-label={label} className="absolute top-full right-0 z-30 mt-1.5 flex min-w-[220px] flex-col rounded-xl border border-line bg-surface p-1 shadow-pop">
          {items.map(it => (
            <button key={it.label} type="button" role="menuitem" onClick={() => { setOpen(false); it.onSelect() }}
              className={cn('flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors',
                it.danger ? 'text-danger hover:bg-danger-soft' : 'text-fg-secondary hover:bg-elevated hover:text-fg')}>
              <it.icon size={14} aria-hidden className="shrink-0" /> {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
