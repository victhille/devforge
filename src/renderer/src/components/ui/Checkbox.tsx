import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  className?: string
}

export default function Checkbox({ checked, onChange, children, className }: Props) {
  return (
    <label className={cn('flex cursor-pointer select-none items-center gap-2 text-fg-secondary hover:text-fg', className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent bg-accent text-white' : 'border-line bg-elevated'
        )}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      {children}
    </label>
  )
}
