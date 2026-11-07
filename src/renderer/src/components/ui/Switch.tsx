import { cn } from '@renderer/lib/cn'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  className?: string
}

/** Forge: 34 × 20, the knob in the text color when off, on the accent when on */
export default function Switch({ checked, onChange, label, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-8.5 shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-active',
        className
      )}
    >
      <span
        className={cn(
          'absolute top-0.75 left-0.75 size-3.5 rounded-full transition-transform',
          checked ? 'translate-x-3.5 bg-accent-fg' : 'bg-fg-secondary'
        )}
      />
    </button>
  )
}
