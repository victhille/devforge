import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

export type BadgeColor = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const COLORS: Record<BadgeColor, string> = {
  default: 'bg-elevated text-fg-secondary',
  accent:  'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger:  'bg-danger-soft text-danger',
  info:    'bg-info-soft text-info'
}

interface Props {
  color?: BadgeColor
  /** v4.3: a dot before the word, in its color (a state: running, stopped…) */
  dot?: boolean
  /** A technical value (a framework, a version, a code), in the code font; a state stays in words */
  mono?: boolean
  className?: string
  children: ReactNode
}

/** Forge: a small square tag, 22 px high */
export default function Badge({ color = 'default', dot, mono, className, children }: Props) {
  return (
    <span className={cn('inline-flex h-5.5 items-center gap-1.5 rounded-md px-2 text-xs leading-none tracking-normal whitespace-nowrap', mono ? 'font-mono font-medium' : 'font-sans font-semibold', COLORS[color], className)}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  )
}
