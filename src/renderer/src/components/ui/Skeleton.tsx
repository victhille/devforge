import type { CSSProperties } from 'react'
import { cn } from '@renderer/lib/cn'
import { useI18n } from '@renderer/i18n/I18nContext'

/** What a loading block says to screen readers: « loading » unless given, nothing with false (the frame around says it) */
function useSaid(label: string | false | undefined): string | undefined {
  const { t } = useI18n()
  return label === false ? undefined : label ?? t.common.loading
}

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
  /** Said to screen readers while it loads: « loading » unless given, nothing with false (the frame around says it) */
  label?: string | false
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
  const said = useSaid(label)
  const cols = Array.from({ length: columns }, (_, c) => c)
  return (
    <div role={said ? 'status' : undefined} aria-label={said} className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
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

/** Widths of the rows' texts and controls, varied but the same at each render */
const LABELS = [34, 26, 40, 30], LINES = [62, 54, 70, 48], CONTROLS = [96, 120, 72, 104]

/**
 * Rows loading, as settings or a list draw them: a label and its line on the left, a control on the right,
 * each row under a line (same paddings as SettingRow, so nothing moves when they come).
 */
export function RowsSkeleton({ rows = 3, control = true, className }: { rows?: number; control?: boolean; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-t border-line-subtle px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5" style={{ width: `${LABELS[r % 4]}%` }} />
            <Skeleton className="h-3" style={{ width: `${LINES[r % 4]}%` }} />
          </div>
          {control && <Skeleton className="h-7.5 shrink-0 rounded-control" style={{ width: CONTROLS[r % 4] }} />}
        </div>
      ))}
    </div>
  )
}

/** A card loading: its title, then its rows (« loading » said to screen readers; `label={false}` inside a frame that says it) */
export function CardSkeleton({ label, rows = 3, className }: { label?: string | false; rows?: number; className?: string }) {
  const said = useSaid(label)
  return (
    <div role={said ? 'status' : undefined} aria-label={said} className={cn('overflow-hidden rounded-card border border-line-subtle bg-surface', className)}>
      <div className="px-5 pt-4.5 pb-3.5"><Skeleton className="h-4 w-32" /></div>
      <RowsSkeleton rows={rows} />
    </div>
  )
}

/** A few lines loading inside a tile or a panel (a Home widget, a framework's panel); `plain`: lines of text, without the value on the right */
export function LinesSkeleton({ lines = 3, label, plain, className }: { lines?: number; label?: string | false; plain?: boolean; className?: string }) {
  const said = useSaid(label)
  return (
    <div role={said ? 'status' : undefined} aria-label={said} className={cn('flex flex-col gap-3 py-1', className)}>
      {Array.from({ length: lines }, (_, r) => (
        <div key={r} className="flex items-center gap-3" style={{ opacity: 1 - (r / lines) * 0.5 }}>
          <Skeleton className="h-3.5" style={{ width: `${LINES[r % 4]}%` }} />
          {!plain && <Skeleton className="ml-auto h-3.5 w-10" />}
        </div>
      ))}
    </div>
  )
}

/** Cards loading in a grid (Projects): each one its icon, its name and path, then its footer */
export function CardGridSkeleton({ cards = 6, label, className }: { cards?: number; label?: string | false; className?: string }) {
  const said = useSaid(label)
  return (
    <div role={said ? 'status' : undefined} aria-label={said} className={cn('grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5', className)}>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="flex flex-col gap-4 rounded-card border border-line-subtle bg-surface p-4" style={{ opacity: 1 - (i / cards) * 0.5 }}>
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-control" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5" style={{ width: `${LABELS[i % 4] + 20}%` }} />
              <Skeleton className="h-3" style={{ width: `${LINES[i % 4]}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-12" /><Skeleton className="ml-auto h-7 w-20 rounded-control" /></div>
        </div>
      ))}
    </div>
  )
}

/** A canvas loading (a diagram, a schema): its strip of tools, then the sheet where the shapes will be */
export function CanvasSkeleton({ label, className }: { label?: string | false; className?: string }) {
  const said = useSaid(label)
  return (
    <div role={said ? 'status' : undefined} aria-label={said} className={cn('flex min-h-[320px] flex-1 flex-col gap-3 p-6', className)}>
      <div className="flex items-center gap-2">{[88, 64, 72, 56].map(w => <Skeleton key={w} className="h-7 rounded-control" style={{ width: w }} />)}</div>
      <Skeleton className="min-h-[260px] flex-1 rounded-card" />
    </div>
  )
}
