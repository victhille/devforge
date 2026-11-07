import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import StatusDot from '@renderer/components/ui/StatusDot'
import Badge, { type BadgeColor } from '@renderer/components/ui/Badge'

// ─── Building blocks ──────────────────────────────────────────────────────────

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('{n}', String(n)))

/** A dashboard card: title row, then content; `i` staggers the entrance */
export function Tile({ i, title, aside, className, children }: { i: number; title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('df-rise df-lift flex min-w-0 flex-col gap-3 rounded-card p-4.5 hover:border-line', className)} style={{ '--i': i } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate font-display text-md font-bold tracking-[-.01em] text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  )
}

/** A state in a card (online, up to date, changed): a badge */
export function Pill({ tone, children }: { tone: 'success' | 'warning' | 'accent' | 'muted'; children: ReactNode }) {
  const colors: Record<typeof tone, BadgeColor> = { success: 'success', warning: 'warning', accent: 'accent', muted: 'default' }
  return <Badge color={colors[tone]} className="shrink-0">{children}</Badge>
}

export function Dot({ live, delay = 0 }: { live: boolean; delay?: number }) {
  return (
    <StatusDot state={live ? 'on' : 'off'} live={live} style={{ animationDelay: `${delay}s` }} />
  )
}

export function Gauge({ label, pct, i }: { label: string; pct: number; i: number }) {
  return (
    <div className="flex flex-col gap-1.5 text-sm">
      <div className="flex justify-between">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono text-fg">{Math.round(pct)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-active">
        <div
          className={cn('df-grow h-full rounded-full', pct >= 80 ? 'bg-warning' : 'bg-accent')}
          style={{ width: `${Math.min(100, pct)}%`, animationDelay: `${i * 0.15}s` }}
        />
      </div>
    </div>
  )
}

export const SmallButton = ({ danger, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) => (
  <button
    {...rest}
    className={cn(
      'h-7.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:opacity-50',
      danger ? 'border-danger/25 bg-danger-soft text-danger hover:border-danger hover:bg-danger hover:text-danger-fg' : 'border-line bg-surface text-fg hover:bg-elevated',
      className
    )}
  />
)
