import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export type BadgeColor = 'default' | 'accent' | 'success' | 'warning' | 'danger'

const COLORS: Record<BadgeColor, string> = {
  default: 'bg-elevated text-fg-secondary',
  accent:  'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger'
}

interface Props {
  color?: BadgeColor
  /** v4.3: a dot before the word, in its color (a state: running, stopped…) */
  dot?: boolean
  className?: string
  children: ReactNode
}

export default function Badge({ color = 'default', dot, className, children }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-medium', COLORS[color], className)}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  )
}
