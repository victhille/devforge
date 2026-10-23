import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'

// ─── Building blocks ──────────────────────────────────────────────────────────

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('{n}', String(n)))

/** A dashboard card: title row, then content; `i` staggers the entrance */
export function Tile({ i, title, aside, className, children }: { i: number; title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('df-rise df-lift flex min-w-0 flex-col gap-3 rounded-[14px] p-[18px] hover:border-line', className)} style={{ '--i': i } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-md font-semibold text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  )
}

export function Pill({ tone, children }: { tone: 'success' | 'warning' | 'accent' | 'muted'; children: ReactNode }) {
  const tones = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    accent: 'bg-accent-soft text-accent',
    muted: 'bg-elevated text-fg-muted'
  }
  return <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-medium', tones[tone])}>{children}</span>
}

export function Dot({ live, delay = 0 }: { live: boolean; delay?: number }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', live ? 'df-ping bg-success' : 'bg-fg-disabled')}
      style={{ animationDelay: `${delay}s` }}
    />
  )
}

export function Gauge({ label, pct, i }: { label: string; pct: number; i: number }) {
  return (
    <div className="flex flex-col gap-1.5 text-[12.5px]">
      <div className="flex justify-between">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono text-fg">{Math.round(pct)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
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
      'h-8 rounded-lg border text-[12.5px] font-medium transition-colors disabled:opacity-50',
      danger ? 'border-danger/30 bg-danger-soft text-danger hover:bg-danger hover:text-white' : 'border-line bg-elevated text-fg hover:bg-hover',
      className
    )}
  />
)
