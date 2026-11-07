import type { ReactNode } from 'react'
import type { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'

export type ToolboxT = ReturnType<typeof useI18n>['t']['toolbox']

interface Props {
  label: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}

/** Titled card used for tool input/output areas. */
export function IoPanel({ label, actions, className, children }: Props) {
  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line-subtle px-3 text-2xs font-semibold uppercase tracking-wider text-fg-muted">
        <span>{label}</span>
        <div className="flex items-center gap-1 normal-case tracking-normal">{actions}</div>
      </div>
      {children}
    </Card>
  )
}

export const IO_TEXTAREA =
  'flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-relaxed text-fg outline-none placeholder:text-fg-muted'

/** Two side-by-side panels taking the remaining height. */
export function IoGrid({ children }: { children: ReactNode }) {
  return <div className="grid min-h-72 flex-1 grid-cols-2 gap-3">{children}</div>
}

export function ToolActions({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 items-center gap-2">{children}</div>
}
