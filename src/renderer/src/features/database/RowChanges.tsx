import { useMemo, useState } from 'react'
import type { DbBrowseResult, DbColumnInfo, DbConnection, DbTableRef } from '@shared/types'
import { previewStatement, rowStatements, type RowChange, type RowValues } from '@shared/lib/rowEdits'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import type { CellValue, GridEditing } from './ResultGrid'

/** Binary columns are shown as "<binary n bytes>": never edited from here */
const BINARY = /blob|binary|bytea|varbinary|image/i

/**
 * v3.6 lot 3: the changes made in the Browse tab before they are applied:
 * cells edited, rows added, rows marked for deletion. Rows are told apart by
 * their primary key, read as they came from the page.
 */
export function useRowChanges(result: DbBrowseResult | null, columns: DbColumnInfo[] | null) {
  const [edits, setEdits] = useState<Map<number, Map<number, string | null>>>(new Map())
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [deleted, setDeleted] = useState<Set<number>>(new Set())
  const [newRows, setNewRows] = useState<CellValue[][]>([])

  const names = result?.columns ?? []
  const info = (col: number) => columns?.find(c => c.name === names[col])
  const primaryKey = (columns ?? []).filter(c => c.key === 'PRI').map(c => c.name)
  const editable = !!result && !!columns && primaryKey.length > 0 && primaryKey.every(k => names.includes(k))

  function reset() { setEdits(new Map()); setChecked(new Set()); setDeleted(new Set()); setNewRows([]) }

  const original = (row: number, col: number) => result?.rows[row]?.[col]
  const same = (a: unknown, b: string | null) => (a === null ? b === null : b !== null && String(a) === b)

  const editing: GridEditing | undefined = editable ? {
    pending: (row, col) => edits.get(row)?.get(col),
    canEdit: col => !BINARY.test(info(col)?.type ?? ''),
    onEdit: (row, col, value) => setEdits(prev => {
      const next = new Map(prev)
      const cells = new Map(next.get(row) ?? [])
      if (same(original(row, col), value)) cells.delete(col)
      else cells.set(col, value)
      if (cells.size) next.set(row, cells)
      else next.delete(row)
      return next
    }),
    isDeleted: row => deleted.has(row),
    isChecked: row => checked.has(row),
    onCheck: (row, on) => setChecked(prev => { const n = new Set(prev); if (on) n.add(row); else n.delete(row); return n }),
    newRows,
    onNewEdit: (index, col, value) => setNewRows(rows => rows.map((r, i) => (i === index ? r.map((v, j) => (j === col ? value : v)) : r))),
    onNewRemove: index => setNewRows(rows => rows.filter((_, i) => i !== index))
  } : undefined

  const changes = useMemo((): RowChange[] => {
    if (!result || !editable) return []
    const keyOf = (row: number): RowValues => Object.fromEntries(primaryKey.map(k => [k, result.rows[row][names.indexOf(k)] as RowValues[string]]))
    const out: RowChange[] = []
    for (const [row, cells] of edits) {
      if (deleted.has(row)) continue
      out.push({ kind: 'update', key: keyOf(row), set: Object.fromEntries([...cells].map(([col, v]) => [names[col], v])) })
    }
    for (const r of newRows) out.push({ kind: 'insert', values: Object.fromEntries(r.flatMap((v, col) => (v === undefined ? [] : [[names[col], v]]))) })
    for (const row of deleted) out.push({ kind: 'delete', key: keyOf(row) })
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps -- primaryKey and names come from result and columns
  }, [result, columns, edits, newRows, deleted, editable])

  return {
    editing, editable, changes, primaryKey, reset,
    checkedCount: checked.size,
    addRow: () => setNewRows(rows => [names.map(() => undefined), ...rows]),
    deleteChecked: () => { setDeleted(prev => new Set([...prev, ...checked])); setChecked(new Set()) },
    restoreChecked: () => { setDeleted(prev => new Set([...prev].filter(r => !checked.has(r)))); setChecked(new Set()) }
  }
}

/** The statements about to run, then Apply: one transaction, all or none */
export function ApplyRowsDialog({ conn, table, changes, onClose, onDone }: {
  conn: DbConnection; table: DbTableRef; changes: RowChange[]; onClose: () => void; onDone: (affected: number) => void
}) {
  const { t } = useI18n()
  const d = t.database
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const preview = rowStatements(conn.type, table, changes).map(s => previewStatement(conn.type, s) + ';')
  async function apply() {
    setRunning(true)
    setError('')
    const r = await window.devforge.db.applyRows(conn.id, table, changes).catch(err => ({ affected: 0, error: String(err) }))
    setRunning(false)
    if (r.error) setError(r.error)
    else onDone(r.affected)
  }
  return (
    <Modal title={d.applyRowsTitle.replace('{n}', String(changes.length))} onClose={onClose} className="max-w-[820px]"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
        <Button loading={running} onClick={apply}>{d.apply}</Button>
      </>}>
      <p className="text-sm text-fg-secondary">{d.applyRowsHint}</p>
      <pre data-testid="rows-preview" className="max-h-72 overflow-auto rounded-lg border border-line-subtle bg-console p-3 font-mono text-xs leading-relaxed text-fg-secondary">{preview.join('\n')}</pre>
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 font-mono text-xs whitespace-pre-wrap text-danger">{d.applyRowsFailed} {error}</p>}
    </Modal>
  )
}
