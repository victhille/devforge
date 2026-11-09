import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

interface Props {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  /** The whole space of a page with nothing to show yet: the frame fills it, its content centred */
  fill?: boolean
}

/**
 * Forge: a compact empty state, one line in a dashed frame (the icon, what is missing, what to do)
 * rather than a big block; the action goes under the words when the space is narrow.
 * With `fill`, the frame takes the rest of the page and its content stands in the middle.
 */
export default function EmptyState({ icon, title, description, action, className, fill }: Props) {
  if (fill) {
    return (
      <div className={cn('df-rise flex flex-1 flex-col items-center justify-center gap-4 rounded-card border border-dashed border-line px-6 py-10 text-center', className)}>
        {icon && <div className="flex size-12 items-center justify-center rounded-xl bg-active text-fg-secondary [&_svg]:size-[22px]">{icon}</div>}
        <div className="max-w-[560px] text-balance">
          <p className="text-md font-semibold text-fg">{title}</p>
          {description && <p className="mt-1 text-sm text-fg-secondary">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
      </div>
    )
  }
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
