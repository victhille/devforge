import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export type BadgeColor = 'default' | 'accent' | 'success' | 'warning' | 'danger'

const COLORS: Record<BadgeColor, string> = {
  default: 'bg-active text-fg-secondary',
  accent:  'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger'
}

interface Props {
  color?: BadgeColor
  className?: string
  children: ReactNode
}

export default function Badge({ color = 'default', className, children }: Props) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', COLORS[color], className)}>
      {children}
    </span>
  )
}
