import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import { Page, PageHeader } from '@renderer/components/ui/Page'

export interface WizardStep {
  label: string
  state: 'done' | 'current' | 'todo'
  /** A done step: back to it */
  onClick?: () => void
}

/** The title and the steps bar: done in green with their value, the current ones lit, the next ones outlined */
export function WizardHeader({ steps, subtitle }: { steps: WizardStep[]; subtitle?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t.newProject.title} subtitle={subtitle} />
      <ol aria-label={t.newProject.stepsLabel} className="flex flex-wrap gap-2">
        {steps.map((s, i) => {
          const text = `${i + 1} · ${s.label}`
          const cls = cn('flex h-8 items-center gap-1.5 rounded-full px-3 text-sm',
            s.state === 'done' ? 'bg-success/10 text-success' : s.state === 'current' ? 'bg-active font-semibold text-fg' : 'border border-line text-fg-muted')
          return (
            <li key={i} aria-current={s.state === 'current' ? 'step' : undefined}>
              {s.state === 'done' && s.onClick
                ? <button type="button" onClick={s.onClick} className={cn(cls, 'transition-colors hover:bg-success/20')}><Check size={12} strokeWidth={2.6} />{text}</button>
                : <span className={cls}>{s.state === 'done' && <Check size={12} strokeWidth={2.6} />}{text}</span>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Always at the bottom: back on the left, a hint in the middle, the next action on the right */
export function WizardFooter({ onBack, hint, children, className }: { onBack: () => void; hint?: ReactNode; children: ReactNode; className?: string }) {
  const { t } = useI18n()
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3', className)}>
      <Button variant="secondary" onClick={onBack}>{t.newProject.back}</Button>
      {hint && <span className="min-w-0 flex-1 text-center text-sm text-fg-muted">{hint}</span>}
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

/** A step of the new project wizard, after the choice of the framework */
export default function WizardFrame({ steps, subtitle, onBack, hint, footer, children }: {
  steps: WizardStep[]
  subtitle?: ReactNode
  onBack: () => void
  hint?: ReactNode
  /** The action(s) on the right of the footer; none while the project is being created */
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Page className="max-w-[1180px] gap-5">
      <WizardHeader steps={steps} subtitle={subtitle} />
      {children}
      {footer && <WizardFooter onBack={onBack} hint={hint}>{footer}</WizardFooter>}
    </Page>
  )
}
