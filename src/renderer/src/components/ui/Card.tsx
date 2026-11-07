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
        'rounded-card border border-line-subtle bg-surface',
        // Forge: a card that leads somewhere rises a little and its border darkens; its background stays
        interactive && 'df-lift cursor-pointer hover:border-fg-muted',
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
  // Forge: card titles in the display font
  return <h3 {...rest} className={cn('flex items-center gap-2 font-display text-md font-bold tracking-[-.01em] text-fg', className)} />
}
