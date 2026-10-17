import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

const FIELD =
  'w-full rounded-lg border border-line bg-elevated px-3 text-base text-fg placeholder:text-fg-muted ' +
  'outline-none transition-colors focus:border-accent focus-visible:outline-none disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  function Input({ className, invalid, ...rest }, ref) {
    return <input ref={ref} {...rest} className={cn(FIELD, 'h-9', invalid && 'border-danger', className)} />
  }
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} {...rest} className={cn(FIELD, 'resize-y py-2 font-mono text-sm leading-relaxed', className)} />
  }
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select ref={ref} {...rest} className={cn(FIELD, 'h-9 cursor-pointer pr-8', className)} />
  }
)

interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}

/** Label + control + hint/error, stacked. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-xs font-medium text-fg-secondary">{label}</span>}
      {children}
      {error ? (
        <span className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-fg-muted">{hint}</span>
      ) : null}
    </label>
  )
}
