import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

/** Scrollable page container with standard padding (Forge: 26 px above, 36 on the sides, 20 between blocks; room for Forgy below) */
export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('df-rise mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-9 pt-6.5 pb-24', className)} />
}

interface HeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Where the page sits (its group, its server), above the title */
  crumb?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Page title row: the title in the display font, the subtitle under it, actions on the right,
 * aligned on the title's foot (the icon is kept for the API, not drawn)
 */
export function PageHeader({ title, subtitle, crumb, actions, className }: HeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-3.5', className)}>
      <div className="min-w-[220px] flex-1">
        {crumb && <div className="mb-1 flex min-w-0 items-center gap-1.5 truncate text-sm text-fg-muted">{crumb}</div>}
        <h1 className="truncate font-display text-page font-bold tracking-[-.025em] text-fg">{title}</h1>
        {subtitle && <p className="mt-1 text-base text-fg-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

/** A group's name above a list of cards (Forge: small capitals in the text font, not the code font) */
export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...rest}
      className={cn('text-xs font-semibold uppercase tracking-[.04em] text-fg-muted', className)}
    />
  )
}
