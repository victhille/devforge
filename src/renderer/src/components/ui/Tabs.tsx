import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export interface TabItem<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

interface Props<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/** Segmented control: a recessed track with one raised, active segment. */
export default function Tabs<T extends string>({ items, value, onChange, className }: Props<T>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex h-9 w-fit shrink-0 items-center gap-0.5 self-start rounded-lg border border-line-subtle bg-canvas p-0.5', className)}
    >
      {items.map(item => {
        const active = value === item.value
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 rounded-md px-3.5 text-sm font-medium transition-all',
              active
                ? 'bg-active text-fg shadow-sm ring-1 ring-line'
                : 'text-fg-secondary hover:bg-hover hover:text-fg'
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
