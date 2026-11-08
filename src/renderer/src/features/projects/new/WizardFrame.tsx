import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import { Page } from '@renderer/components/ui/Page'

export interface WizardStep {
  label: string
  /** A word under the label (optional) */
  hint?: string
  state: 'done' | 'current' | 'todo'
  /** A done step: back to it */
  onClick?: () => void
}

/** The steps, one under the other as in the mock-up: a numbered dot, green and ticked once done, on the accent while current */
export function WizardSteps({ steps }: { steps: WizardStep[] }) {
  const { t } = useI18n()
  return (
    <ol aria-label={t.newProject.stepsLabel} className="flex flex-col gap-1">
      {steps.map((s, i) => {
        const cls = cn('flex min-h-9 w-full min-w-0 items-center gap-2.5 rounded-control px-2.5 py-1.5 text-left text-base',
          s.state === 'current' ? 'bg-accent-soft font-semibold text-fg' : s.state === 'done' ? 'text-fg-secondary' : 'text-fg-muted')
        const body = (
          <>
            {/* 1.5 px around the number, as in the mock-up (.ws i) */}
            <span aria-hidden className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-full border-[1.5px] text-xs font-bold',
              s.state === 'done' ? 'border-transparent bg-success-soft text-success'
                : s.state === 'current' ? 'border-accent bg-accent text-accent-fg' : 'border-line')}>
              {s.state === 'done' ? <Check size={12} strokeWidth={2.6} /> : i + 1}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span>{s.label}</span>
              {s.hint && <span className="text-xs font-normal text-fg-muted">{s.hint}</span>}
            </span>
            {s.state === 'done' && <span className="sr-only"> ({t.newProject.stepDone})</span>}
          </>
        )
        return (
          <li key={i} aria-current={s.state === 'current' ? 'step' : undefined}>
            {s.state === 'done' && s.onClick
              ? <button type="button" onClick={s.onClick} className={cn(cls, 'transition-colors hover:bg-elevated hover:text-fg')}>{body}</button>
              : <span className={cls}>{body}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * A screen of the new project wizard, as in the mock-up (measures of .df-mockup):
 * where it is and its title, then three columns: the steps, the step itself, and a
 * card on the right that says what will be made, with Back and the next action.
 * The columns follow the width of the page, not of the window: when the step would
 * be too narrow (a 1280 px window), the card goes under the steps, still at the top.
 */
export default function WizardFrame({ steps, title, subtitle, headerRight, onBack, hint, footer, asideTitle, aside, children }: {
  steps: WizardStep[]
  title?: string
  subtitle?: ReactNode
  /** On the right of the title (the switch between technologies and templates) */
  headerRight?: ReactNode
  onBack?: () => void
  /** A line under the card on the right */
  hint?: ReactNode
  /** The next action(s), at the bottom of the card on the right */
  footer?: ReactNode
  asideTitle?: string
  aside?: ReactNode
  children: ReactNode
}) {
  const { t } = useI18n()
  return (
    <Page className="df-mockup max-w-[1320px] gap-5">
      <header className="df-rise flex flex-wrap items-end justify-between gap-3.5">
        <div className="min-w-0">
          <p className="mb-1 text-sm text-fg-muted">{t.nav.groupDev} / {t.newProject.title}</p>
          <h1 className="font-display text-page font-bold tracking-[-.025em] text-fg">{title ?? t.newProject.title}</h1>
          {subtitle && <p className="mt-1 text-base text-fg-secondary">{subtitle}</p>}
        </div>
        {headerRight}
      </header>
      <div className="@container">
        <div className="grid grid-cols-1 items-start gap-5 @min-[720px]:grid-cols-[200px_minmax(0,1fr)] @min-[720px]:grid-rows-[auto_1fr] @min-[1120px]:grid-cols-[200px_minmax(0,1fr)_280px]">
        <div className="@min-[720px]:col-start-1 @min-[720px]:row-start-1"><WizardSteps steps={steps} /></div>
        <div className="flex min-w-0 flex-col gap-4 @min-[720px]:col-start-2 @min-[720px]:row-span-2 @min-[720px]:row-start-1">{children}</div>
        {(aside || footer || onBack) && (
          <aside className="@container/aside flex min-w-0 flex-col gap-3.5 rounded-card border border-line-subtle bg-surface p-4.5 @min-[720px]:sticky @min-[720px]:top-4 @min-[720px]:col-start-1 @min-[720px]:row-start-2 @min-[1120px]:col-start-3 @min-[1120px]:row-span-2 @min-[1120px]:row-start-1">
            {asideTitle && <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{asideTitle}</h2>}
            {aside}
            {hint && <p className="text-xs text-fg-muted">{hint}</p>}
            {/* The next action first (footer: the main button first), then Back. Under the steps (200 px), one under
                the other in that order; in the 280 px card, side by side with Back on the left, as in the mock-up.
                250 px: between the two widths of the card (its padding included) */}
            {(footer || onBack) && (
              <div className="flex flex-col gap-2 @min-[250px]/aside:flex-row-reverse @min-[250px]/aside:items-center">
                {footer && <div className="flex min-w-0 flex-col gap-2 @min-[250px]/aside:flex-1 @min-[250px]/aside:flex-row-reverse @min-[250px]/aside:[&>*]:flex-1">{footer}</div>}
                {onBack && <Button variant="ghost" className="text-fg-muted" onClick={onBack}>{t.newProject.back}</Button>}
              </div>
            )}
          </aside>
        )}
        </div>
      </div>
    </Page>
  )
}

/** What was chosen, in the card on the right: label and value side by side, or one under the other when the card is narrow */
export function RecapList({ rows }: { rows: { label: string; value: ReactNode; mono?: boolean }[] }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm @min-[250px]/aside:grid @min-[250px]/aside:grid-cols-[auto_minmax(0,1fr)] @min-[250px]/aside:gap-x-3 @min-[250px]/aside:gap-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex min-w-0 flex-col gap-0.5 @min-[250px]/aside:contents">
          <dt className="text-xs text-fg-muted @min-[250px]/aside:text-sm">{r.label}</dt>
          <dd className={cn('min-w-0 truncate text-fg', r.mono && 'font-mono')} title={typeof r.value === 'string' ? r.value : undefined}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A label above a group (FRONTEND, BASE DE DONNÉES…), as in the mock-up */
export const FamilyLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-xs font-semibold tracking-[.04em] text-fg-muted uppercase">{children}</p>
)

/** A row of options (a switch, a choice): a thin line between rows */
export function OptionRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-line-subtle py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-fg">{label}</div>
        {hint && <div className="text-xs text-fg-muted">{hint}</div>}
      </div>
      {children}
    </div>
  )
}
