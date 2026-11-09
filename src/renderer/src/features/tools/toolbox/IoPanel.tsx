import type { ReactNode } from 'react'
import type { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

export type ToolboxT = ReturnType<typeof useI18n>['t']['toolbox']

interface Props {
  label: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}

/**
 * As in the mock-up: a card titled « Entrée » or « Résultat », its actions on
 * the right; what is typed sits in a framed field, what comes out (a read-only
 * field) on the console's dark background.
 */
export function IoPanel({ label, actions, className, children }: Props) {
  return (
    <section className={cn('df-rise flex min-h-0 flex-col overflow-hidden rounded-card border border-line-subtle bg-surface', className)}>
      <div className="flex h-13 shrink-0 items-center justify-between gap-3 px-4.5">
        <h2 className="font-display text-md font-bold text-fg">{label}</h2>
        <div className="flex items-center gap-1.5 text-sm">{actions}</div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-4.5 pb-4.5 [&_textarea[readonly]]:border-transparent [&_textarea[readonly]]:bg-console">
        {children}
      </div>
    </section>
  )
}

export const IO_TEXTAREA =
  'min-h-48 flex-1 resize-none rounded-control border border-line-subtle bg-canvas p-3.5 font-mono text-sm leading-relaxed text-fg outline-none placeholder:text-fg-muted focus:border-accent'

/** Two side-by-side panels taking the remaining height. */
export function IoGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-h-72 flex-1 gap-4 lg:grid-cols-2">{children}</div>
}

export function ToolActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
}
