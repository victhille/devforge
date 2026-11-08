import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from './Card'

export type StatTone = 'success' | 'warning' | 'danger' | 'accent'

const TONES: Record<StatTone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
  accent:  'text-accent'
}

interface Props {
  label: ReactNode
  value: ReactNode
  /** Small words after the value (a unit, "12 min", "tonight · done") */
  unit?: ReactNode
  /** The value's color; none keeps the text color */
  tone?: StatTone
  className?: string
}

/** Forge: a count on a card, its name first then the value in large (Git, Monitoring, Health, Backups…) */
export default function Stat({ label, value, unit, tone, className }: Props) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-0.5 p-3.5', className)}>
      <span className="truncate text-sm text-fg-muted">{label}</span>
      <span className={cn('truncate font-display text-2xl leading-tight font-bold tracking-[-.02em]', tone ? TONES[tone] : 'text-fg')}>
        {value}
        {unit && <small className="ml-1 font-sans text-sm font-medium tracking-normal text-fg-muted">{unit}</small>}
      </span>
    </Card>
  )
}

/** A row of counts, as many columns as there are counts (two below 640 px) */
export function StatRow({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('grid grid-cols-2 gap-3 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none', className)} />
}
