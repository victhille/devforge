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
      className={cn('inline-flex h-9 w-fit shrink-0 items-center gap-0.5 rounded-[10px] border border-line bg-canvas p-[3px]', className)}
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
              'inline-flex h-full items-center gap-1.5 rounded-[7px] px-3 text-[12.5px] font-medium transition-colors',
              active
                ? 'bg-elevated text-fg shadow-sm'
                : 'text-fg-secondary hover:text-fg'
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
