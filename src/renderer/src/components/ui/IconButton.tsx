import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  tone?: 'default' | 'danger'
  size?: 'sm' | 'md'
}

/** Square icon-only button. Always pass a `title` for accessibility. */
const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { active, tone = 'default', size = 'md', className, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      {...rest}
      aria-label={rest['aria-label'] ?? rest.title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors',
        'hover:bg-hover hover:text-fg disabled:opacity-40',
        size === 'sm' ? 'size-7' : 'size-8',
        tone === 'danger' && 'hover:bg-danger-soft hover:text-danger',
        active && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent',
        className
      )}
    />
  )
})

export default IconButton
