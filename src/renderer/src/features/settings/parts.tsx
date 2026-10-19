import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'

/** One settings section: a card with its title and a line about it */
export function SettingsCard({ title, hint, icon, children, className }: { title: ReactNode; hint?: ReactNode; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('df-rise overflow-hidden', className)}>
      <div className="flex items-center gap-3.5 px-5 pt-[18px] pb-3.5">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-fg">{title}</h2>
          {hint && <p className="mt-1 text-[12.5px] text-fg-secondary">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

/** Label and help on the left, the control on the right (stacks when narrow) */
export function SettingRow({ label, hint, children, className, danger }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; className?: string; danger?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line-subtle px-5 py-4', danger && 'bg-danger-soft/40', className)}>
      <div className="min-w-0 flex-[1_1_240px]">
        <div className={cn('text-[13.5px] font-medium', danger ? 'text-danger' : 'text-fg')}>{label}</div>
        {hint && <div className="mt-[3px] text-[12.5px] text-fg-secondary">{hint}</div>}
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
    <div role="radiogroup" aria-label={label} className="flex flex-wrap rounded-[10px] border border-line bg-canvas p-[3px]">
      {items.map(item => (
        <button key={item.value} type="button" role="radio" aria-checked={value === item.value} onClick={() => onChange(item.value)}
          className={cn('h-7 rounded-[7px] px-3.5 text-[12.5px] font-medium transition-colors', mono && 'font-mono',
            value === item.value ? 'bg-elevated text-fg shadow-sm' : 'text-fg-secondary hover:text-fg')}>
          {item.label}
        </button>
      ))}
    </div>
  )
}
