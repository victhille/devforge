import { createContext, useContext, useId, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import StatusDot from '@renderer/components/ui/StatusDot'
import Badge, { type BadgeColor } from '@renderer/components/ui/Badge'
import Spinner from '@renderer/components/ui/Spinner'

/** The id of the card's title: its links and buttons are described by it (« Gérer », of which card) */
const TileTitle = createContext<string | undefined>(undefined)

// ─── Building blocks ──────────────────────────────────────────────────────────

export const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('{n}', String(n)))

/**
 * A dashboard card, as in the mock-up: its icon, its title in the display font,
 * what it is about on a line below (a server, a Compose project), and on the right
 * a state or a link. A region named by its title; `i` staggers the entrance.
 */
export function Tile({ i, title, icon: Icon, sub, aside, className, children }: {
  i: number; title: ReactNode; icon?: LucideIcon; sub?: ReactNode; aside?: ReactNode; className?: string; children: ReactNode
}) {
  const id = useId()
  return (
    <TileTitle.Provider value={id}>
    <section aria-labelledby={id} style={{ '--i': i } as CSSProperties}
      className={cn('df-rise flex min-w-0 flex-col gap-4 rounded-card border border-line-subtle bg-surface p-5.5', className)}>
      <div className="flex flex-col gap-0.5">
        <div className="flex min-h-7 items-center gap-3">
          {Icon && <Icon size={16} aria-hidden className="shrink-0 text-fg-secondary" />}
          <h2 id={id} title={typeof title === 'string' ? title : undefined} className="min-w-0 flex-1 truncate font-display text-lg font-bold tracking-[-.01em] text-fg">{title}</h2>
          {aside}
        </div>
        {sub && <p title={typeof sub === 'string' ? sub : undefined} className={cn('truncate text-sm text-fg-muted', Icon && 'pl-8')}>{sub}</p>}
      </div>
      {children}
    </section>
    </TileTitle.Provider>
  )
}

/** The link in a card's corner (Tout voir, Gérer…): words in the accent, 24 px high to be easy to hit */
export function TileLink({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const title = useContext(TileTitle)
  return (
    <button type="button" aria-describedby={title} {...rest}
      className={cn('-mx-1 inline-flex min-h-7.5 shrink-0 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-50', className)}>
      {children}
    </button>
  )
}

/** A card while its data is read: the spinner in the middle of a little room, not a dot under the title */
export function TileLoading() {
  return <div className="flex min-h-16 items-center justify-center"><Spinner /></div>
}

/** A row of a card's list: 39 px, a thin line between rows */
export const ROW = 'flex min-h-12 min-w-0 items-center gap-3 border-b border-line-subtle last:border-b-0'

/** A card's actions, at its bottom, on the left */
export function TileActions({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-0.5">{children}</div>
}

/** A state in a card (online, up to date, changed): a badge */
export function Pill({ tone, children }: { tone: 'success' | 'warning' | 'accent' | 'danger' | 'muted'; children: ReactNode }) {
  const colors: Record<typeof tone, BadgeColor> = { success: 'success', warning: 'warning', accent: 'accent', danger: 'danger', muted: 'default' }
  return <Badge color={colors[tone]} className="h-7 shrink-0 px-2.5">{children}</Badge>
}

export function Dot({ live, delay = 0 }: { live: boolean; delay?: number }) {
  return (
    <StatusDot state={live ? 'on' : 'off'} live={live} style={{ animationDelay: `${delay}s` }} />
  )
}

export function Gauge({ label, pct, i }: { label: string; pct: number; i: number }) {
  const value = Math.round(pct)
  return (
    <div className="flex flex-col gap-2 text-sm">
      {/* Said once by the meter below, with its value */}
      <div aria-hidden className="flex justify-between">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono text-fg">{value} %</span>
      </div>
      <div role="meter" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${value} %`} className="h-2 overflow-hidden rounded-full bg-active">
        <div
          className={cn('df-grow h-full rounded-full', pct >= 80 ? 'bg-warning' : 'bg-accent')}
          style={{ width: `${Math.min(100, pct)}%`, animationDelay: `${i * 0.15}s` }}
        />
      </div>
    </div>
  )
}

/** A small button of a card: secondary by default, red when it stops something */
export function SmallButton({ danger, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  const title = useContext(TileTitle)
  return (
  <button
    type="button"
    aria-describedby={title}
    {...rest}
    className={cn(
      'inline-flex h-9 items-center justify-center gap-2 rounded-control border px-3.5 text-sm font-semibold transition-colors disabled:opacity-50',
      danger ? 'border-danger/25 bg-danger-soft text-danger hover:border-danger hover:bg-danger hover:text-danger-fg' : 'border-line bg-surface text-fg hover:bg-elevated',
      className
    )}
  />
  )
}
