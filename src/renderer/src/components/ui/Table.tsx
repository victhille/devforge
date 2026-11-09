import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/cn'

/**
 * Forge's dense table: 34 px headers in small muted words, 42 px rows with a line
 * between them, the row under the mouse lit; it scrolls sideways rather than squeeze
 */
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        {...rest}
        className={cn('w-full border-collapse text-sm [&_tbody_tr:hover_td]:bg-elevated [&_tbody_tr:last-child_td]:border-b-0', className)}
      />
    </div>
  )
}

/** A header cell; `align="right"` for numbers and actions */
export function Th({ className, align, ...rest }: Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> & { align?: 'right' }) {
  return (
    <th
      {...rest}
      className={cn('h-8.5 border-b border-line-subtle px-3.5 text-left text-xs font-semibold whitespace-nowrap text-fg-muted', align === 'right' && 'text-right', className)}
    />
  )
}

/** A body cell */
export function Td({ className, align, ...rest }: Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> & { align?: 'right' }) {
  return <td {...rest} className={cn('h-10.5 border-b border-line-subtle px-3.5', align === 'right' && 'text-right', className)} />
}
