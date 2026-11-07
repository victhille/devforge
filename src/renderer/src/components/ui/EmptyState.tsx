import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

interface Props {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * Forge: a compact empty state, one line in a dashed frame (the icon, what is missing, what to do)
 * rather than a big block; the action goes under the words when the space is narrow.
 */
export default function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'df-rise flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-card border border-dashed border-line px-4.5 py-4',
        className
      )}
    >
      {/* 20 px whatever size the page gives: the line stays compact */}
      {icon && <div className="shrink-0 text-fg-muted [&_svg]:size-5">{icon}</div>}
      <div className="min-w-[200px] flex-1">
        <p className="text-base font-semibold text-fg">{title}</p>
        {description && <p className="mt-0.5 text-sm text-fg-secondary">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}
