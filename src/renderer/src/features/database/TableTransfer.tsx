import { useEffect, useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import type { CsvPreview, DbConnection, DbTableRef, ExportFormat } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import Modal from '@renderer/components/ui/Modal'
import { Select } from '@renderer/components/ui/Input'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** v3.6 lot 4: the whole table into a file, in the format picked */
export function ExportMenu({ conn, table }: { conn: DbConnection; table: DbTableRef }) {
  const { t } = useI18n()
  const d = t.database
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  async function run(format: ExportFormat) {
    setOpen(false)
    setBusy(true)
    try {
      const r = await window.devforge.db.exportTable(conn.id, table, format)
      if (r) toast.show({ tone: 'success', title: d.exported.replace('{n}', String(r.rows)), description: r.path })
    } catch (err) { toast.show({ tone: 'error', title: d.exportFailed, description: errorText(err) }) }
    finally { setBusy(false) }
  }

  const items: [ExportFormat, string][] = [['csv', 'CSV'], ['json', 'JSON'], ['sql', d.exportSql], ['sql-create', d.exportSqlCreate]]
  return (
    <div ref={box} className="relative">
      <Button size="sm" variant="ghost" loading={busy} aria-expanded={open} onClick={() => setOpen(o => !o)}><Download size={13} /> {d.exportTable}</Button>
      {open && (
        <div role="menu" className="absolute top-full left-0 z-30 mt-1 min-w-[220px] rounded-xl border border-line bg-surface p-1 shadow-lg">
          {items.map(([f, label]) => (
            <button key={f} role="menuitem" onClick={() => run(f)} className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-fg hover:bg-hover">{label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/** v3.6 lot 4: a CSV into the table: its columns matched by name, a preview, then one transaction */
export function ImportDialog({ conn, table, columns, onClose, onDone }: {
  conn: DbConnection; table: DbTableRef; columns: string[]; onClose: () => void; onDone: (inserted: number) => void
}) {
  const { t } = useI18n()
  const d = t.database
  const [preview, setPreview] = useState<CsvPreview | null>(null)
  const [mapping, setMapping] = useState<(string | null)[]>([])
  const [emptyIsNull, setEmptyIsNull] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function pick() {
    setError('')
    const r = await window.devforge.db.pickCsv(conn.id, table).catch(err => ({ error: errorText(err) }))
    if (!r) return
    if ('error' in r) { setError(r.error === 'TOO_BIG' ? d.importTooBig : r.error === 'EMPTY' ? d.importEmpty : r.error); return }
    setPreview(r)
    setMapping(r.mapping)
  }

  async function run() {
    if (!preview) return
    setBusy(true)
    setError('')
    const r = await window.devforge.db.importCsv(conn.id, table, preview.token, mapping, emptyIsNull).catch(err => ({ inserted: 0, error: errorText(err), line: undefined }))
    setBusy(false)
    if (r.error) setError(r.line ? d.importFailedLine.replace('{line}', String(r.line)).replace('{error}', r.error) : `${d.importFailed} ${r.error}`)
    else onDone(r.inserted)
  }

  const used = mapping.filter(Boolean).length
  return (
    <Modal title={d.importTitle.replace('{table}', table.name)} onClose={onClose} className="max-w-[900px]"
      footer={<>
        <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
        <Button disabled={!preview || !used} loading={busy} onClick={run}><Upload size={13} /> {preview ? d.importRun.replace('{n}', String(preview.total)) : d.importRunEmpty}</Button>
      </>}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={pick}>{preview ? d.importOther : d.importPick}</Button>
        {preview && <span className="text-xs text-fg-muted">{d.importFile.replace('{name}', preview.name).replace('{n}', String(preview.total))
          .replace('{sep}', preview.separator === '\t' ? 'tab' : preview.separator).replace('{enc}', preview.encoding)}</span>}
      </div>
      {preview && (
        <>
          <p className="text-xs text-fg-secondary">{d.importMapHint}</p>
          <div className="max-h-80 overflow-auto rounded-lg border border-line-subtle">
            <table className="w-max min-w-full border-collapse font-mono text-xs">
              <thead className="sticky top-0 bg-elevated">
                <tr>{preview.headers.map((h, i) => <th key={i} className="border-r border-b border-line-subtle px-2 py-1.5 text-left font-semibold text-fg">{h}</th>)}</tr>
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="border-r border-b border-line-subtle p-1">
                      <Select aria-label={d.importColumn.replace('{col}', h)} value={mapping[i] ?? ''} className="h-7 py-0 text-xs"
                        onChange={e => setMapping(m => m.map((x, j) => (j === i ? e.target.value || null : x)))}>
                        <option value="">{d.importSkip}</option>
                        {columns.map(c => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.sample.map((r, ri) => (
                  <tr key={ri}>{preview.headers.map((_, i) => <td key={i} className="max-w-60 truncate border-r border-b border-line-subtle px-2 py-1 text-fg-secondary">{r[i] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <Checkbox checked={emptyIsNull} onChange={setEmptyIsNull} className="text-sm">{d.importEmptyNull}</Checkbox>
          <p className="text-xs text-fg-muted">{d.importTransaction}</p>
        </>
      )}
      {error && <p role="alert" className="rounded-lg bg-danger-soft p-2.5 font-mono text-xs whitespace-pre-wrap text-danger">{error}</p>}
    </Modal>
  )
}
