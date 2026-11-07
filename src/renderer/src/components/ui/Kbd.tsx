import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

/** Forge: a key or a shortcut (Ctrl K, ↵, Échap), in the code font on a small raised tag */
export default function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd className={cn('rounded-md border border-line bg-elevated px-1.5 font-mono text-2xs leading-4 whitespace-nowrap text-fg-secondary', className)}>
      {children}
    </kbd>
  )
}
