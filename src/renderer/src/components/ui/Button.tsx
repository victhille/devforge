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
  primary:   'bg-accent text-white hover:bg-accent-hover',
  secondary: 'bg-elevated text-fg border border-line hover:bg-hover',
  ghost:     'bg-transparent text-fg-secondary hover:bg-hover hover:text-fg',
  danger:    'bg-danger-soft text-danger hover:bg-danger hover:text-white'
}

const SIZES: Record<Size, string> = {
  sm: 'h-7 px-2.5 text-sm',
  md: 'h-[34px] px-3.5 text-base',
  lg: 'h-10 px-5 text-md'
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
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium',
        'transition-colors disabled:opacity-40',
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
