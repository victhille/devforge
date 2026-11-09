import type { CSSProperties } from 'react'
import { cn } from '@renderer/lib/cn'

/**
 * Forge: what is loading drawn as soft blocks of its own shape, calmer than a
 * spinner and without the page jumping when the data comes. The pulse stops
 * with reduced motion (styles: data-motion and the system setting).
 * Blocks are hidden from screen readers: the frame that holds them says « loading ».
 */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden className={cn('block rounded-md bg-active motion-safe:animate-pulse', className)} style={style} />
}

/** Widths that read as data: varied, but the same at each render (no jump) */
const WIDTHS = [72, 54, 88, 64, 96, 46, 80, 60]
const width = (row: number, col: number) => WIDTHS[(row * 3 + col * 5) % WIDTHS.length]
/** Each column's own width, header and rows alike */
const colWidth = (col: number) => 96 + ((col * 37) % 64)

interface TableSkeletonProps {
  /** Said to screen readers while it loads (none: the frame around says it) */
  label?: string
  rows?: number
  columns?: number
  /** A strip of buttons above (a table's actions) */
  toolbar?: boolean
  className?: string
}

/**
 * A table loading: its header, then rows of cells, fading out towards the
 * bottom. Same paddings as the real grid, so the rows land where the data will.
 */
export function TableSkeleton({ label, rows = 8, columns = 5, toolbar, className }: TableSkeletonProps) {
  const cols = Array.from({ length: columns }, (_, c) => c)
  return (
    <div role={label ? 'status' : undefined} aria-label={label} className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
      {toolbar && (
        <div className="flex shrink-0 items-center gap-5 border-b border-line-subtle px-4 py-3">
          {[78, 104, 96].map(w => <Skeleton key={w} className="h-4" style={{ width: w }} />)}
          <Skeleton className="ml-auto h-4 w-16" />
        </div>
      )}
      <div className="flex shrink-0 gap-8 border-b border-line-subtle px-3.5 py-3">
        <Skeleton className="h-3 w-5" />
        {cols.map(c => (
          <span key={c} className="block shrink-0" style={{ width: colWidth(c) }}><Skeleton className="h-3 w-1/2" /></span>
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex shrink-0 items-center gap-8 border-b border-line-subtle px-3.5 py-3.5" style={{ opacity: 1 - (r / rows) * 0.7 }}>
          <Skeleton className="h-3.5 w-5" />
          {cols.map(c => (
            <span key={c} className="block shrink-0" style={{ width: colWidth(c) }}>
              <Skeleton className="h-3.5" style={{ width: `${width(r, c)}%` }} />
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
