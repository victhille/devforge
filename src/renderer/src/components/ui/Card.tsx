import type { HTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

interface Props extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
}

export default function Card({ interactive, className, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-xl border border-line-subtle bg-surface',
        interactive && 'cursor-pointer transition-colors hover:border-line hover:bg-elevated',
        className
      )}
    />
  )
}

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3', className)}
    />
  )
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 {...rest} className={cn('flex items-center gap-2 text-sm font-semibold text-fg', className)} />
}
