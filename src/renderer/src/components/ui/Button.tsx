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

/** Forge: flat, no shadow; the main action in orange, the others on the surface */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-accent font-semibold text-accent-fg hover:bg-accent-hover',
  secondary:
    'border border-line bg-surface font-semibold text-fg hover:bg-elevated',
  ghost:
    'bg-transparent font-medium text-fg-secondary hover:bg-elevated hover:text-fg',
  danger:
    'border border-danger/25 bg-danger-soft font-semibold text-danger hover:border-danger hover:bg-danger hover:text-danger-fg'
}

/** 30, 36 and 44 px */
const SIZES: Record<Size, string> = {
  sm: 'h-7.5 gap-1.5 rounded-md px-3 text-sm',
  md: 'h-9 gap-2 rounded-control px-4 text-base',
  lg: 'h-11 gap-2 rounded-control px-6 text-md'
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
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap',
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
