import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

interface Props<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  /** `segmented`: a recessed track with one raised segment; `underline` (v4.3): a row of words, the chosen one underlined */
  variant?: 'segmented' | 'underline'
  /** Names the group for screen readers */
  label?: string
  className?: string
}

/** Tabs: two looks, one behavior (the arrows move from one tab to the next, v4.3) */
export default function Tabs<T extends string>({ items, value, onChange, variant = 'segmented', label, className }: Props<T>) {
  const usable = items.filter(i => !i.disabled)
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    const edge = e.key === 'Home' ? 0 : e.key === 'End' ? usable.length - 1 : -1
    if (!step && edge < 0) return
    e.preventDefault()
    const at = usable.findIndex(i => i.value === value)
    const next = edge >= 0 ? usable[edge] : usable[(at + step + usable.length) % usable.length]
    if (!next) return
    onChange(next.value)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-tab="${next.value}"]`)?.focus()
  }
  const underline = variant === 'underline'
  // The tab Tab reaches: the chosen one, else the first usable (a value that matches none must not leave the row unreachable)
  const reachable = usable.some(i => i.value === value) ? value : usable[0]?.value

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKey}
      className={cn(
        underline
          ? 'flex min-w-0 items-end gap-4 overflow-x-auto border-b border-line-subtle'
          : 'inline-flex h-9 w-fit shrink-0 items-center gap-0.5 rounded-control border border-line bg-canvas p-[3px]',
        className
      )}
    >
      {items.map(item => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-tab={item.value}
            aria-selected={active}
            tabIndex={item.value === reachable ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex items-center gap-1.5 font-medium whitespace-nowrap transition-colors disabled:opacity-40',
              underline
                ? cn('-mb-px h-9 border-b-2 px-0.5 text-base', active ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg')
                : cn('h-full rounded-[7px] px-3 text-sm', active ? 'bg-elevated text-fg shadow-sm' : 'text-fg-secondary hover:text-fg')
            )}
          >
            {item.icon && <span className={cn(active ? 'text-accent' : 'text-current')}>{item.icon}</span>}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
