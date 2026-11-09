import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

/**
 * Forge: a key or a shortcut (Ctrl K, ↵, Échap), in the code font on a small raised tag.
 * `md` where the keys are read as instructions (the palette's hints): 24 px high, 11 px text (rem of 13 px)
 */
export default function Kbd({ children, size = 'sm', className }: { children: ReactNode; size?: 'sm' | 'md'; className?: string }) {
  return (
    <kbd className={cn(
      'rounded-md border border-line bg-elevated font-mono whitespace-nowrap text-fg-secondary',
      size === 'md' ? 'inline-flex h-7.5 min-w-7.5 items-center justify-center px-2.5 text-xs' : 'px-1.5 text-2xs leading-4',
      className
    )}>
      {children}
    </kbd>
  )
}
