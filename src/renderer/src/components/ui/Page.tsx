import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

/** Scrollable page container with standard padding. */
export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('df-rise mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-8 pt-7 pb-24', className)} />
}

interface HeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Page title row: large title, muted subtitle, actions on the right (the icon is kept for the API, not drawn) */
export function PageHeader({ title, subtitle, actions, className }: HeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[26px] leading-tight font-semibold tracking-[-.02em] text-fg">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...rest}
      className={cn('font-mono text-2xs font-medium uppercase tracking-widest text-fg-muted', className)}
    />
  )
}
