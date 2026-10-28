import { useId, useState, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { DbColumnInfo, DbConnection, DbTableRef } from '@shared/types'
import {
  COLUMN_TYPES, EMPTY_COLUMN, addColumnSql, alterColumnSql, columnDefOf, columnProblem, createTableSql,
  dropColumnSql, dropTableSql, renameTableSql, type ColumnDef
} from '@shared/lib/tableDdl'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input } from '@renderer/components/ui/Input'

/**
 * v3.5.1: create, change and drop tables and columns. Every dialog shows the
 * SQL first; nothing runs before "Apply". Statements run one by one and stop
 * at the first error, which stays on screen.
 */

function useApply(connId: string, onDone: () => void) {
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  async function apply(statements: string[]) {
    setRunning(true)
    setError('')
    for (const sql of statements) {
      const r = await window.devforge.db.query(connId, sql)
      if (r.error) { setError(r.error); setRunning(false); return }
    }
    setRunning(false)
    onDone()
  }
  return { running, error, apply }
}

/** The SQL about to run, and the error if it failed */
function SqlPreview({ statements, error, note }: { statements: string[]; error: string; note?: ReactNode }) {
  const { t } = useI18n()
  const d = t.database
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-fg-secondary">{d.ddlPreview}</span>
      <pre data-testid="ddl-preview" className="max-h-48 overflow-auto rounded-lg border border-line-subtle bg-console p-3 font-mono text-xs leading-relaxed text-fg-secondary">
        {statements.length ? statements.map(s => s + ';').join('\n\n') : <span className="text-fg-muted">{d.ddlNothing}</span>}
      </pre>
      {note}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 font-mono text-xs whitespace-pre-wrap text-danger">{error}</p>}
    </div>
  )
}

function Footer({ onClose, onApply, disabled, running, danger, label }: { onClose: () => void; onApply: () => void; disabled: boolean; running: boolean; danger?: boolean; label: string }) {
  const { t } = useI18n()
  return (
    <>
      <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
      <Button variant={danger ? 'danger' : 'primary'} disabled={disabled} loading={running} onClick={onApply}>{label}</Button>
    </>
  )
}

function problemText(d: ReturnType<typeof useI18n>['t']['database'], p: ReturnType<typeof columnProblem>) {
  return p === 'name' ? d.colProblemName : p === 'type' ? d.colProblemType : p === 'autoIncrement' ? d.colProblemAuto : ''
}

/** One column's fields, on one row */
function ColumnFields({ conn, value, onChange, onRemove, withKey = true }: {
  conn: DbConnection; value: ColumnDef; onChange: (c: ColumnDef) => void; onRemove?: () => void; withKey?: boolean
}) {
  const { t } = useI18n()
  const d = t.database
  const list = useId()
  const set = (patch: Partial<ColumnDef>) => onChange({ ...value, ...patch })
  const problem = (value.name || value.type) ? columnProblem(conn.type, value) : null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={d.colName} placeholder={d.colName} value={value.name} onChange={e => set({ name: e.target.value })} className="h-8 w-[150px] font-mono text-xs" spellCheck={false} />
        <Input aria-label={d.colType} placeholder={d.colType} value={value.type} list={list} onChange={e => set({ type: e.target.value })} invalid={problem === 'type'} className="h-8 w-[150px] font-mono text-xs" spellCheck={false} />
        <datalist id={list}>{COLUMN_TYPES[conn.type].map(x => <option key={x} value={x} />)}</datalist>
        <Input aria-label={d.colDefault} placeholder={d.colDefault} value={value.default} disabled={value.autoIncrement} onChange={e => set({ default: e.target.value })} className="h-8 w-[130px] font-mono text-xs" spellCheck={false} />
        <Checkbox checked={!value.nullable} onChange={v => set({ nullable: !v })} className="text-xs">{d.colRequired}</Checkbox>
        {withKey && <Checkbox checked={value.primary} onChange={v => set({ primary: v, ...(v ? { nullable: false } : { autoIncrement: false }) })} className="text-xs">{d.colPrimary}</Checkbox>}
        {withKey && <Checkbox checked={value.autoIncrement} onChange={v => set({ autoIncrement: v, ...(v ? { primary: true, nullable: false, default: '' } : {}) })} className="text-xs">{d.colAuto}</Checkbox>}
        {onRemove && <IconButton size="sm" tone="danger" title={d.colRemove} onClick={onRemove}><Trash2 size={13} /></IconButton>}
      </div>
      {problem && <p className="text-2xs text-warning">{problemText(d, problem)}</p>}
    </div>
  )
}

/** The first column of a new table: an auto-incremented id */
const ID_TYPE = { postgres: 'integer', mysql: 'INT', sqlite: 'INTEGER' } as const

export function CreateTableDialog({ conn, onClose, onDone }: { conn: DbConnection; onClose: () => void; onDone: (name: string) => void }) {
  const { t } = useI18n()
  const d = t.database
  const [name, setName] = useState('')
  const [columns, setColumns] = useState<ColumnDef[]>([
    { ...EMPTY_COLUMN, name: 'id', type: ID_TYPE[conn.type], nullable: false, primary: true, autoIncrement: true },
    { ...EMPTY_COLUMN }
  ])
  const filled = columns.filter(c => c.name.trim() || c.type.trim())
  const valid = !!name.trim() && filled.length > 0 && filled.every(c => !columnProblem(conn.type, c))
  const statements = valid ? createTableSql(conn.type, { name: name.trim(), schema: '' }, filled) : []
  const { running, error, apply } = useApply(conn.id, () => onDone(name.trim()))
  return (
    <Modal title={d.newTable} onClose={onClose} className="max-w-[860px]"
      footer={<Footer onClose={onClose} onApply={() => apply(statements)} disabled={!valid} running={running} label={d.createTable} />}>
      <Field label={d.tableName}><Input autoFocus value={name} onChange={e => setName(e.target.value)} className="font-mono" spellCheck={false} /></Field>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-fg-secondary">{d.columnsTitle.replace('{n}', String(filled.length))}</span>
        {columns.map((c, i) => (
          <ColumnFields key={i} conn={conn} value={c} onChange={v => setColumns(columns.map((x, j) => (j === i ? v : x)))}
            onRemove={columns.length > 1 ? () => setColumns(columns.filter((_, j) => j !== i)) : undefined} />
        ))}
        <Button variant="secondary" size="sm" className="self-start" onClick={() => setColumns([...columns, { ...EMPTY_COLUMN }])}><Plus size={13} /> {d.addColumn}</Button>
      </div>
      <SqlPreview statements={statements} error={error} />
    </Modal>
  )
}

/** Add a column (no `column`) or change one */
export function ColumnDialog({ conn, table, column, onClose, onDone }: {
  conn: DbConnection; table: DbTableRef; column?: DbColumnInfo; onClose: () => void; onDone: () => void
}) {
  const { t } = useI18n()
  const d = t.database
  const [value, setValue] = useState<ColumnDef>(() => (column ? columnDefOf(column) : { ...EMPTY_COLUMN }))
  const problem = columnProblem(conn.type, { ...value, autoIncrement: false })
  const result = problem ? [] : column ? alterColumnSql(conn.type, table, column, value) : addColumnSql(conn.type, table, value)
  const unsupported = result === 'unsupported'
  const statements = unsupported ? [] : result
  const { running, error, apply } = useApply(conn.id, onDone)
  return (
    <Modal title={column ? d.editColumn.replace('{name}', column.name) : d.addColumn} onClose={onClose} className="max-w-[760px]"
      footer={<Footer onClose={onClose} onApply={() => apply(statements)} disabled={!statements.length} running={running} label={d.apply} />}>
      <ColumnFields conn={conn} value={value} onChange={setValue} withKey={false} />
      <SqlPreview statements={statements} error={error}
        note={unsupported ? <p className="text-xs text-warning">{d.sqliteAlter}</p> : !column && !value.nullable && !value.default.trim() ? <p className="text-xs text-fg-muted">{d.requiredHint}</p> : null} />
    </Modal>
  )
}

export function RenameTableDialog({ conn, table, onClose, onDone }: { conn: DbConnection; table: DbTableRef; onClose: () => void; onDone: (name: string) => void }) {
  const { t } = useI18n()
  const d = t.database
  const [name, setName] = useState(table.name)
  const statements = name.trim() && name.trim() !== table.name ? renameTableSql(conn.type, table, name) : []
  const { running, error, apply } = useApply(conn.id, () => onDone(name.trim()))
  return (
    <Modal title={d.renameTable} onClose={onClose} className="max-w-lg"
      footer={<Footer onClose={onClose} onApply={() => apply(statements)} disabled={!statements.length} running={running} label={d.apply} />}>
      <Field label={d.tableName}><Input autoFocus value={name} onChange={e => setName(e.target.value)} className="font-mono" spellCheck={false} /></Field>
      <SqlPreview statements={statements} error={error} />
    </Modal>
  )
}

/** Dropping a table: its name typed again */
export function DropTableDialog({ conn, table, onClose, onDone }: { conn: DbConnection; table: DbTableRef; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const d = t.database
  const [typed, setTyped] = useState('')
  const statements = dropTableSql(conn.type, table)
  const { running, error, apply } = useApply(conn.id, onDone)
  return (
    <Modal title={d.dropTable} onClose={onClose} className="max-w-lg"
      footer={<Footer onClose={onClose} onApply={() => apply(statements)} disabled={typed !== table.name} running={running} danger label={d.dropTable} />}>
      <p className="text-sm text-fg-secondary">{d.dropTableWarn}</p>
      <Field label={d.dropTableType.replace('{name}', table.name)}>
        <Input autoFocus value={typed} onChange={e => setTyped(e.target.value)} className={cn('font-mono')} spellCheck={false} />
      </Field>
      <SqlPreview statements={statements} error={error} />
    </Modal>
  )
}

export function DropColumnDialog({ conn, table, column, onClose, onDone }: { conn: DbConnection; table: DbTableRef; column: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const d = t.database
  const statements = dropColumnSql(conn.type, table, column)
  const { running, error, apply } = useApply(conn.id, onDone)
  return (
    <Modal title={d.dropColumn.replace('{name}', column)} onClose={onClose} className="max-w-lg"
      footer={<Footer onClose={onClose} onApply={() => apply(statements)} disabled={false} running={running} danger label={d.dropColumnShort} />}>
      <p className="text-sm text-fg-secondary">{d.dropColumnWarn}</p>
      <SqlPreview statements={statements} error={error} />
    </Modal>
  )
}
