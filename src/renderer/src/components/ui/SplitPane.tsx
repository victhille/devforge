import type { ReactNode } from 'react'
import { cn } from '@renderer/lib/cn'

/** The side's width once the page is wide enough (written out whole: Tailwind only builds the classes it reads) */
const WIDTH = {
  sm: '@min-[720px]:w-52',
  md: '@min-[720px]:w-64',
  lg: '@min-[720px]:w-72',
  xl: '@min-[720px]:w-80'
} as const

interface Props {
  /** The list on the side (projects, commands, snippets…) */
  side: ReactNode
  children: ReactNode
  width?: keyof typeof WIDTH
  /** Names the list for screen readers (« Projets », « Commandes »…) */
  label: string
  /** The side's own background (the sidebar's, by default) */
  sideClassName?: string
  className?: string
}

/**
 * v4.3: a list beside its content, filling the page's height. When the page is
 * narrow (a small window, Forgy's panel open) the list goes above the content,
 * its height capped, instead of leaving the content no room — as the menus of
 * Settings and Docker do since v4.2.
 */
export default function SplitPane({ side, children, width = 'md', label, sideClassName, className }: Props) {
  return (
    <div className={cn('@container h-full min-h-0', className)}>
      <div className="flex h-full min-h-0 flex-col @min-[720px]:flex-row">
        <aside aria-label={label} className={cn('flex max-h-56 shrink-0 flex-col border-b border-line-subtle bg-sidebar @min-[720px]:max-h-none @min-[720px]:border-r @min-[720px]:border-b-0', WIDTH[width], sideClassName)}>
          {side}
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
