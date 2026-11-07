import { useState } from 'react'
import type { DbConnection, Project } from '@shared/types'
import { useDbConnections } from '@renderer/hooks/useLiveData'
import { useI18n } from '@renderer/i18n/I18nContext'
import { errorText } from '@renderer/lib/errors'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Field, Input } from '@renderer/components/ui/Input'
import { ImportProgress, useModelImport } from './ImportProgress'

/**
 * v4.1: a new physical model. No database: a blank MPD, drawn table by table;
 * a connection: its tables read into an MPD linked to it, and the MCD worked
 * out from it (v3.9 lot 4), step by step. Resolves with the MPD's file name.
 */
export default function MpdDialog({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: (file: string) => void }) {
  const { t } = useI18n()
  const m = t.modeling
  const l = m.linked
  // v4.2: the kept list of connections
  const list = useDbConnections()
  const connections: DbConnection[] | null = list.data ?? (list.error ? [] : null)
  /** '' : none, a blank MPD */
  const [conn, setConn] = useState('')
  const [name, setName] = useState(project.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const imp = useModelImport()

  async function go() {
    if (!name.trim()) return
    if (conn) {
      const r = await imp.run(project.path, conn, name.trim())
      if (r) onDone(r.mpd)
      return
    }
    setBusy(true)
    try { onDone(await window.devforge.modeling.create(project.path, 'mpd', name.trim())) }
    catch (err) { setError(errorText(err)); setBusy(false) }
  }

  return (
    <Modal title={m.newTitle.replace('{kind}', m.kindName.mpd)} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button>
        <Button onClick={go} loading={busy || imp.busy} disabled={busy || imp.busy || !name.trim()}>{conn ? l.importButton : m.createButton}</Button>
      </>}>
      <div className="flex flex-col gap-3">
        {!connections ? <Spinner /> : (
          <Field label={l.importConnection}>
            <select value={conn} onChange={e => { setConn(e.target.value); imp.reset() }}
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent">
              <option value="">{l.blankOption}</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {m.mpd.engines[c.type]}</option>)}
            </select>
          </Field>
        )}
        <p className="text-sm text-fg-secondary">{conn ? l.importHint : l.blankHint}</p>
        <Field label={m.name} error={error || undefined}>
          <Input value={name} onChange={e => { setName(e.target.value); setError(''); imp.reset() }} onKeyDown={e => { if (e.key === 'Enter') go() }} />
        </Field>
        <ImportProgress progress={imp.progress} details={imp.details} error={imp.error} className="rounded-lg border border-line-subtle p-3" />
      </div>
    </Modal>
  )
}
