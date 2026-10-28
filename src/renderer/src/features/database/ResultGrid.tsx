import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Save, X } from 'lucide-react'
import IconButton from '@renderer/components/ui/IconButton'
import type { DbQueryResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import CopyButton from '@renderer/components/ui/CopyButton'
import { formatResult, type ResultFormat } from '@shared/lib/resultExport'

/** v3.5.1: copy the rows as CSV or JSON (the choice is kept) */
function CopyAs({ result }: { result: DbQueryResult }) {
  const { t } = useI18n()
  const [format, setFormat] = usePersistentState<ResultFormat>('devforge:db-copy-format', 'csv')
  return (
    <span className="ml-auto flex items-center gap-1">
      <span role="group" aria-label={t.database.copyAs} className="flex rounded-md border border-line p-px">
        {(['csv', 'json'] as const).map(f => (
          <button key={f} aria-pressed={format === f} onClick={() => setFormat(f)}
            className={cn('h-5 rounded px-1.5 font-mono text-[10.5px] uppercase', format === f ? 'bg-active text-fg' : 'text-fg-muted hover:text-fg')}>{f}</button>
        ))}
      </span>
      <CopyButton text={formatResult(result, format)} title={t.database.copyFormat.replace('{f}', format.toUpperCase())} />
      {/* v3.6: the same, into a file */}
      <IconButton size="sm" title={t.database.saveFormat.replace('{f}', format.toUpperCase())}
        onClick={() => { void window.devforge.db.saveResult('result', formatResult(result, format), format) }}><Save size={13} /></IconButton>
    </span>
  )
}

export interface GridSort { column: string; desc: boolean }

/** A cell's value while editing: text, NULL, or (a new row) left to its default */
export type CellValue = string | null | undefined

/** v3.6 lot 3: what makes the grid editable (Browse tab, a table with a primary key) */
export interface GridEditing {
  /** The cell's pending value, undefined when unchanged */
  pending: (row: number, col: number) => CellValue
  canEdit: (col: number) => boolean
  onEdit: (row: number, col: number, value: string | null) => void
  isDeleted: (row: number) => boolean
  isChecked: (row: number) => boolean
  onCheck: (row: number, on: boolean) => void
  /** Rows being added, shown first; undefined: the column's default */
  newRows: CellValue[][]
  onNewEdit: (index: number, col: number, value: CellValue) => void
  onNewRemove: (index: number) => void
}

/** One cell's text field: Enter keeps, Escape leaves, NULL in one click */
function CellInput({ initial, onDone, nullLabel }: { initial: string; onDone: (value: string | null | false) => void; nullLabel: string }) {
  const [text, setText] = useState(initial)
  return (
    <span className="flex items-center gap-1">
      <input autoFocus value={text} onChange={e => setText(e.target.value)} aria-label={nullLabel}
        onKeyDown={e => { if (e.key === 'Enter') onDone(text); if (e.key === 'Escape') onDone(false) }}
        onBlur={() => onDone(text)}
        className="h-6 min-w-[120px] flex-1 rounded border border-accent bg-canvas px-1.5 font-mono text-xs text-fg outline-none" />
      <button onMouseDown={e => { e.preventDefault(); onDone(null) }} className="h-6 rounded border border-line px-1.5 text-[10.5px] text-fg-muted hover:text-fg">NULL</button>
    </span>
  )
}

interface Props {
  result: DbQueryResult
  /** Number of the first row (paged browsing) */
  rowOffset?: number
  /** Clickable headers when set */
  sort?: GridSort | null
  onSort?: (sort: GridSort | null) => void
  /** Replaces the row count on the left of the toolbar (pagination) */
  toolbar?: ReactNode
  /** v3.6: cells edited in place */
  editing?: GridEditing
}

const show = (v: unknown) => (v === null ? 'NULL' : String(v))

export default function ResultGrid({ result, rowOffset = 0, sort, onSort, toolbar, editing }: Props) {
  const { t } = useI18n()
  const d = t.database
  const [cell, setCell] = useState<{ row: number; col: number; isNew: boolean } | null>(null)

  if (result.error) {
    return <div className="m-3 rounded-lg bg-danger-soft p-3 font-mono text-sm whitespace-pre-wrap text-danger">{result.error}</div>
  }
  if (result.columns.length === 0) {
    return (
      <div className="m-3 rounded-lg bg-success-soft p-3 text-sm text-success">
        {d.affected.replace('{n}', String(result.affected ?? 0))} · {result.durationMs} ms
      </div>
    )
  }

  // asc → desc → none
  const nextSort = (column: string): GridSort | null =>
    sort?.column !== column ? { column, desc: false } : !sort.desc ? { column, desc: true } : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-line-subtle px-3 py-1.5 text-xs text-fg-muted">
        {toolbar ?? <span>{d.rows.replace('{n}', String(result.rows.length))}{result.truncated ? ` (${d.truncated})` : ''}</span>}
        <span>{result.durationMs} ms</span>
        <CopyAs result={result} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-collapse font-mono text-xs">
          <thead className="sticky top-0 z-10 bg-elevated">
            <tr>
              {editing && <th className="w-8 border-r border-b border-line-subtle px-2 py-1.5"><span className="sr-only">{d.rowSelect}</span></th>}
              <th className="border-r border-b border-line-subtle px-2 py-1.5 text-right text-fg-muted">#</th>
              {result.columns.map((c, i) => (
                <th key={i} className="border-r border-b border-line-subtle p-0 text-left font-semibold whitespace-nowrap text-fg">
                  {onSort ? (
                    <button onClick={() => onSort(nextSort(c))} title={d.sortHint}
                      className="flex w-full items-center gap-1 px-3 py-1.5 hover:bg-hover">
                      {c}
                      {sort?.column === c && (sort.desc ? <ArrowDown size={11} className="text-accent" /> : <ArrowUp size={11} className="text-accent" />)}
                    </button>
                  ) : <span className="block px-3 py-1.5">{c}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Rows being added: empty cells keep the column's default */}
            {editing?.newRows.map((row, ni) => (
              <tr key={`new-${ni}`} data-testid="new-row" className="bg-success-soft/40">
                <td className="border-r border-b border-line-subtle px-1 text-center">
                  <button onClick={() => editing.onNewRemove(ni)} title={d.rowNewRemove} aria-label={d.rowNewRemove} className="rounded p-0.5 text-fg-muted hover:text-danger"><X size={11} /></button>
                </td>
                <td className="border-r border-b border-line-subtle px-2 py-1 text-right text-success">+</td>
                {result.columns.map((col, ci) => {
                  const v = row[ci]
                  const open = cell?.isNew && cell.row === ni && cell.col === ci
                  return (
                    <td key={ci} onDoubleClick={() => setCell({ row: ni, col: ci, isNew: true })}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'F2') setCell({ row: ni, col: ci, isNew: true }) }} tabIndex={0}
                      className={cn('max-w-80 truncate border-r border-b border-line-subtle px-3 py-1', v === undefined ? 'italic text-fg-muted' : v === null ? 'italic text-fg-muted' : 'text-fg')}>
                      {open
                        ? <CellInput initial={v ?? ''} nullLabel={d.cellLabel.replace('{col}', col)} onDone={x => { if (x !== false) editing.onNewEdit(ni, ci, x === '' ? undefined : x); setCell(null) }} />
                        : v === undefined ? d.cellDefault : show(v)}
                    </td>
                  )
                })}
              </tr>
            ))}
            {result.rows.map((row, ri) => {
              const deleted = editing?.isDeleted(ri)
              return (
                <tr key={ri} className={cn('hover:bg-hover', deleted && 'bg-danger-soft/40 line-through')}>
                  {editing && (
                    <td className="border-r border-b border-line-subtle px-2 text-center">
                      <input type="checkbox" className="size-3.5 accent-accent" aria-label={d.rowCheck.replace('{n}', String(rowOffset + ri + 1))}
                        checked={editing.isChecked(ri)} onChange={e => editing.onCheck(ri, e.target.checked)} />
                    </td>
                  )}
                  <td className="border-r border-b border-line-subtle px-2 py-1 text-right text-fg-muted">{rowOffset + ri + 1}</td>
                  {row.map((v, ci) => {
                    const pending = editing?.pending(ri, ci)
                    const changed = pending !== undefined
                    const value = changed ? pending : v
                    const editable = !!editing && !deleted && editing.canEdit(ci)
                    const open = editable && !cell?.isNew && cell?.row === ri && cell.col === ci
                    return (
                      <td key={ci} title={show(value)}
                        {...(editable ? {
                          tabIndex: 0,
                          onDoubleClick: () => setCell({ row: ri, col: ci, isNew: false }),
                          onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === 'F2') setCell({ row: ri, col: ci, isNew: false }) }
                        } : {})}
                        className={cn('max-w-80 truncate border-r border-b border-line-subtle px-3 py-1',
                          changed && 'bg-warning-soft text-fg', !changed && (value === null ? 'italic text-fg-muted' : 'text-fg-secondary'))}>
                        {open
                          ? <CellInput initial={value === null ? '' : String(value)} nullLabel={d.cellLabel.replace('{col}', result.columns[ci])}
                              onDone={x => { if (x !== false) editing!.onEdit(ri, ci, x); setCell(null) }} />
                          : show(value)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
