import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'
import Spinner from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-sm shadow-accent/20 ring-1 ring-inset ring-white/10 ' +
    'hover:bg-accent-hover',
  secondary:
    'bg-elevated text-fg border border-line shadow-sm ' +
    'hover:bg-hover hover:border-fg-muted/40',
  ghost:
    'bg-transparent text-fg-secondary hover:bg-hover hover:text-fg',
  danger:
    'bg-danger-soft text-danger border border-danger/20 hover:bg-danger hover:text-white hover:border-danger'
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-sm',
  md: 'h-8 gap-1.5 rounded-lg px-3.5 text-base',
  lg: 'h-10 gap-2 rounded-lg px-5 text-md'
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium',
        'transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        loading && 'cursor-wait',
        className
      )}
    >
      {loading && <Spinner className="border-current border-t-transparent" />}
      {children}
    </button>
  )
})

export default Button
