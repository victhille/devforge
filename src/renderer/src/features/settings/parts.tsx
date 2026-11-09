import { Fragment, type ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'

/** One settings group: a card with its title, a line about it and, on the right, its action (Back up now, See the curves…) */
export function SettingsCard({ title, hint, icon, action, danger, children, className }: {
  title: ReactNode; hint?: ReactNode; icon?: ReactNode; action?: ReactNode
  /** The sensitive zone: its header in the danger tone */
  danger?: boolean
  children: ReactNode; className?: string
}) {
  return (
    <Card className={cn('df-rise overflow-hidden', danger && 'border-danger/40', className)}>
      <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-2 px-5 pt-4.5 pb-3.5', danger && 'bg-danger-soft')}>
        {icon}
        <div className="min-w-[200px] flex-1">
          <h2 className={cn('font-display text-md font-bold tracking-[-.01em]', danger ? 'text-danger' : 'text-fg')}>{title}</h2>
          {hint && <p className="mt-1 text-sm text-fg-secondary">{hint}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {children}
    </Card>
  )
}

/** Label and help on the left, the control on the right (stacks when narrow; `stacked`: always under the label) */
export function SettingRow({ label, hint, children, className, danger, stacked }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string; danger?: boolean; stacked?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line-subtle px-5 py-4', danger && 'bg-danger-soft/40', className)}>
      <div className={cn('min-w-0', stacked ? 'w-full flex-none' : 'flex-[1_1_240px]')}>
        <div className={cn('text-base font-medium', danger ? 'text-danger' : 'text-fg')}>{label}</div>
        {hint && <div className="mt-[3px] text-sm text-fg-secondary">{hint}</div>}
      </div>
      {children}
    </div>
  )
}

/** Choice among a few values, as a segmented control with radio semantics */
export function Segmented<T extends string>({ value, onChange, items, label, mono }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode }[]; label: string; mono?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap rounded-control border border-line bg-canvas p-[3px]">
      {items.map(item => (
        <button key={item.value} type="button" role="radio" aria-checked={value === item.value} onClick={() => onChange(item.value)}
          className={cn('h-7 rounded-[7px] px-3.5 text-sm font-medium transition-colors', mono && 'font-mono',
            value === item.value ? 'bg-elevated text-fg shadow-sm' : 'text-fg-secondary hover:text-fg')}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

/** A sentence with pieces set in it: « {key} l'accepte » with a key, « ({link}) » with a link */
export function Words({ text, parts }: { text: string; parts: Record<string, ReactNode> }) {
  return <>{text.split(/(\{\w+\})/).map((bit, i) => <Fragment key={i}>{/^\{\w+\}$/.test(bit) ? parts[bit.slice(1, -1)] ?? bit : bit}</Fragment>)}</>
}
