import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

/** Scrollable page container with standard padding. */
export function Page({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={cn('mx-auto flex w-full max-w-6xl flex-col gap-7 px-10 py-8', className)} />
}

interface HeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, icon, actions, className }: HeaderProps) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-fg">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-fg-secondary">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export function SectionTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...rest}
      className={cn('text-2xs font-semibold uppercase tracking-widest text-fg-muted', className)}
    />
  )
}
