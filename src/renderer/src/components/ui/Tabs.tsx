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

/** Segmented control: a row of pill buttons, one active. */
export default function Tabs<T extends string>({ items, value, onChange, className }: Props<T>) {
  return (
    <div className={cn('inline-flex shrink-0 gap-0.5 rounded-lg border border-line-subtle bg-surface p-0.5', className)}>
      {items.map(item => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors',
            value === item.value
              ? 'bg-accent-soft text-accent'
              : 'text-fg-secondary hover:bg-hover hover:text-fg'
          )}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  )
}
