import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Copy, Database, DownloadCloud, FileCode2, Play, RefreshCw, Save } from 'lucide-react'
import type { DbConnection, DbDiagram, MpdDiff, MpdModel } from '@shared/types'
import { dbTablesOf, diffScript } from '@shared/lib/mpdDb'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { fill } from './model'

const SIGN: Record<MpdDiff['kind'], string> = {
  tableMissing: '+', columnMissing: '+', fkMissing: '+', tableExtra: '−', columnExtra: '−', fkExtra: '−', type: '~', nullable: '~', pk: '~'
}

/**
 * v3.9 lot 4: under the MPD, its linked database. Which connection, what
 * differs (+ missing from the database, − only in it, ~ different), and the
 * ways to bring them together.
 */
export default function LinkedPanel({ mpd, connections, suggested, diagram, loading, error, diffs, onLink, onRefresh, onScript, onAdopt }: {
  mpd: MpdModel
  connections: DbConnection[]
  /** The connection the project's .env points at, when not linked yet */
  suggested?: DbConnection
  diagram?: DbDiagram
  loading: boolean
  error?: string
  diffs: MpdDiff[] | null
  onLink: (id: string | undefined) => void
  onRefresh: () => void
  onScript: () => void
  onAdopt: () => void
}) {
  const { t } = useI18n()
  const l = t.modeling.linked
  const engine = t.modeling.mpd.engines[mpd.engine]
  const usable = connections.filter(c => c.type === mpd.engine)
  const conn = connections.find(c => c.id === mpd.connection)
  const name = conn?.name ?? ''

  return (
    <section aria-label={l.label} className="flex max-h-[240px] shrink-0 flex-col border-t border-line-subtle bg-surface">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <Database size={14} className="text-fg-muted" />
        <select aria-label={l.label} value={mpd.connection ?? ''} onChange={e => onLink(e.target.value || undefined)}
          className="h-8 max-w-[220px] rounded-md border border-line bg-canvas px-2 text-sm text-fg outline-none focus:border-accent">
          <option value="">{l.none}</option>
          {usable.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!conn ? (
          <>
            {suggested
              ? <Button size="sm" variant="secondary" onClick={() => onLink(suggested.id)} title={l.suggestHint}>{fill(l.suggest, { name: suggested.name })}</Button>
              : <span className="text-sm text-fg-muted">{fill(usable.length ? l.noneHint : l.noConnection, { engine })}</span>}
          </>
        ) : loading ? <span className="flex items-center gap-2 text-sm text-fg-muted"><Spinner className="h-3.5 w-3.5" /> {l.loading}</span>
          : error ? <span role="status" className="min-w-0 truncate text-sm text-danger">{fill(l.unreachable, { error })}</span>
          : diffs && (
            <span role="status" className={cn('text-sm font-medium', diffs.length ? 'text-warning' : 'text-success')}>
              {diffs.length ? `${fill(l.diffTitle, { name })} · ${fill(l.count, { n: diffs.length })}` : fill(l.same, { name })}
            </span>
          )}
        <span className="flex-1" />
        {conn && <>
          <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}><RefreshCw size={13} /> {l.refresh}</Button>
          <Button size="sm" variant="secondary" onClick={onAdopt} disabled={!diagram || !diffs?.length}><DownloadCloud size={13} /> {l.adopt}</Button>
          <Button size="sm" onClick={onScript} disabled={!diagram || !diffs?.length}><FileCode2 size={13} /> {l.showScript}</Button>
        </>}
      </div>
      {conn && !!diffs?.length && (
        <ul className="min-h-0 overflow-y-auto px-4 pb-2.5 font-mono text-xs">
          {diffs.map((d, i) => (
            <li key={i} data-diff={d.kind} className="flex gap-2 py-0.5">
              <span className={cn('w-3 shrink-0 font-bold', SIGN[d.kind] === '+' ? 'text-success' : SIGN[d.kind] === '−' ? 'text-danger' : 'text-warning')}>{SIGN[d.kind]}</span>
              <span className={d.danger ? 'text-danger' : 'text-fg-secondary'}>{fill(l.diff[d.kind], { table: d.table, column: d.column ?? '', mpd: d.mpd ?? '', db: d.db ?? '' })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * The script that brings the database to the MPD: read before it runs. What
 * loses data is in red, with a backup offered first and a box to tick; a
 * Symfony project gets a Doctrine migration instead.
 */
export function ScriptDialog({ mpd, conn, diagram, diffs, projectPath, symfony, onDone, onClose }: {
  mpd: MpdModel
  conn: DbConnection
  diagram: DbDiagram
  diffs: MpdDiff[]
  projectPath: string
  symfony: boolean
  onDone: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const l = t.modeling.linked
  const toast = useToast()
  const lines = useMemo(() => diffScript(mpd, diffs, l.notes), [mpd, diffs, l.notes])
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  const statements = lines.filter(x => !x.comment).map(x => x.sql)
  const danger = diffs.filter(d => d.danger)
  // The tables a drop touches, as the database names them, to back them up
  const touched = useMemo(() => {
    const names = new Set(danger.map(d => d.table.toLowerCase()))
    return dbTablesOf(diagram).filter(x => names.has(x.name.toLowerCase()))
  }, [danger, diagram])

  async function backup() {
    setBusy(true)
    try {
      let n = 0
      for (const x of touched) if (await window.devforge.db.exportTable(conn.id, { name: x.name, schema: x.schema }, 'sql')) n++
      if (n) toast.show({ tone: 'success', title: fill(l.backedUp, { n }) })
    } catch (err) { toast.show({ tone: 'error', title: l.backupFailed, description: errorText(err) }) }
    finally { setBusy(false) }
  }
  async function apply() {
    setBusy(true)
    setFailure('')
    const r = await window.devforge.modeling.apply(conn.id, statements).catch(err => ({ ok: false as const, error: errorText(err), index: -1 }))
    setBusy(false)
    if (!r.ok) { setFailure(fill(l.applyFailed, { n: r.index + 1, error: r.error })); return }
    toast.show({ tone: 'success', title: l.applied, description: conn.name })
    onDone()
  }
  async function migration() {
    setBusy(true)
    try {
      const path = await window.devforge.modeling.doctrine(projectPath, statements, fill(l.doctrineDescription, { name: conn.name }))
      toast.show({ tone: 'success', title: l.doctrineDone, description: path })
      onClose()
    } catch (err) { toast.show({ tone: 'error', title: l.importFailed, description: errorText(err) }) }
    finally { setBusy(false) }
  }
  async function copy() {
    await navigator.clipboard.writeText(lines.map(x => x.sql).join('\n') + '\n')
    toast.show({ tone: 'success', title: l.copied })
  }

  const blocked = busy || !statements.length || (danger.length > 0 && !accepted)
  return (
    <Modal title={fill(l.scriptTitle, { name: conn.name })} onClose={onClose} className="max-w-[760px]"
      footer={<>
        <Button variant="ghost" onClick={copy}><Copy size={13} /> {l.copy}</Button>
        <span className="flex-1" />
        <Button variant={danger.length ? 'danger' : symfony ? 'secondary' : 'primary'} onClick={apply} disabled={blocked}><Play size={13} /> {fill(l.apply, { name: conn.name })}</Button>
        {symfony && <Button onClick={migration} disabled={blocked} title={l.doctrineHint}><FileCode2 size={13} /> {l.doctrine}</Button>}
      </>}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fg-secondary">{fill(l.scriptHint, { name: conn.name })}</p>
        {symfony && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-fg">{l.doctrineHint}</p>}
        <pre tabIndex={0} data-testid="diff-script" className="max-h-[340px] overflow-auto rounded-lg border border-line-subtle bg-canvas p-3 font-mono text-[12px] leading-relaxed">
          {!lines.length ? <span className="text-fg-muted">{l.nothing}</span> : lines.map((x, i) => (
            <div key={i} className={x.danger ? 'text-danger' : x.comment ? 'text-fg-muted' : 'text-fg'}>{x.sql}</div>
          ))}
        </pre>
        {mpd.engine === 'mysql' && statements.length > 1 && <p className="text-xs text-fg-muted">{l.applyMysql}</p>}
        {danger.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger-soft p-3">
            <p className="flex items-start gap-2 text-sm text-fg"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger" />
              {fill(l.danger, { what: danger.map(d => (d.column ? `${d.table}.${d.column}` : d.table)).join(', ') })}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" onClick={backup} disabled={busy || !touched.length} title={l.backupHint}><Save size={13} /> {l.backup}</Button>
              <label className="flex items-center gap-2 text-sm text-fg">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="accent-[var(--color-danger)]" /> {l.accept}
              </label>
            </div>
          </div>
        )}
        {failure && <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm text-danger"><AlertTriangle size={14} className="mt-0.5 shrink-0" /> {failure}</p>}
        {!failure && !statements.length && lines.length > 0 && <p className="flex items-center gap-2 text-sm text-fg-muted"><Check size={14} /> {l.nothing}</p>}
      </div>
    </Modal>
  )
}
