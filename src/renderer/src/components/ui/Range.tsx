import { useEffect, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

/**
 * A slider's value while it moves, saved once on release (the mouse let go, a key up, the focus gone),
 * not at every step: `shown` for the number next to it, `input` for the `<input type="range">`.
 */
export function useRange(value: number, onChange: (v: number) => void): { shown: number; input: InputHTMLAttributes<HTMLInputElement> } {
  const [shown, setShown] = useState(value)
  useEffect(() => setShown(value), [value])
  const commit = () => { if (shown !== value) onChange(shown) }
  return { shown, input: { value: shown, onChange: e => setShown(Number(e.target.value)), onPointerUp: commit, onKeyUp: commit, onBlur: commit } }
}

/** A slider and its value on the right, in the code font (85 %) */
export default function Range({ value, onChange, min, max, step = 1, unit, label, className }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit: string; label: string; className?: string
}) {
  const { shown, input } = useRange(value, onChange)
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <input type="range" min={min} max={max} step={step} aria-label={label} aria-valuetext={`${shown} ${unit}`} {...input} className="min-w-0 flex-1 accent-accent" />
      <span aria-hidden className="min-w-12 shrink-0 text-right font-mono text-sm font-semibold text-fg">{shown} {unit}</span>
    </span>
  )
}
