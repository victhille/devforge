import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

interface Props {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className }: Props) {
  return (
    <div
      className={cn(
        'df-rise flex flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-line px-6 py-12 text-center',
        className
      )}
    >
      {icon && <div className="text-fg-muted">{icon}</div>}
      <div>
        <p className="text-md font-medium text-fg">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-fg-secondary">{description}</p>}
      </div>
      {action}
    </div>
  )
}
