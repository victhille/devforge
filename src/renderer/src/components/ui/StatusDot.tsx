import type { CSSProperties } from 'react'
import { cn } from '@renderer/lib/cn'

export type DotState = 'on' | 'off' | 'warn' | 'error' | 'unknown'

const COLORS: Record<DotState, string> = {
  on: 'bg-success',
  off: 'bg-fg-disabled',
  warn: 'bg-warning',
  error: 'bg-danger',
  // Hollow: nothing is known yet
  unknown: 'border border-fg-muted'
}

interface Props {
  state: DotState
  /** A pulse around the dot: the thing is running right now */
  live?: boolean
  size?: 'sm' | 'md'
  /** Read by screen readers; without it the dot is decoration (its state said in words next to it) */
  label?: string
  className?: string
  /** A delay for the pulse, so that dots side by side do not beat together */
  style?: CSSProperties
}

/** v4.3: the state of a service, a container, a server: one size, one color per state, one pulse, on every page */
export default function StatusDot({ state, live, size = 'sm', label, className, style }: Props) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={style}
      className={cn('inline-block shrink-0 rounded-full', size === 'sm' ? 'size-2' : 'size-2.5', COLORS[state], live && state !== 'unknown' && 'df-ping', className)}
    />
  )
}
