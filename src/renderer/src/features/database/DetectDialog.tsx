import { useCallback, useEffect, useState } from 'react'
import { Check, Container, Database, FileKey2, Plus, Search, Server } from 'lucide-react'
import type { DetectedDatabase, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Select } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'

const SOURCE_ICON = { docker: Container, native: Server, env: FileKey2 }

function CandidateRow({ d, onAdd }: { d: DetectedDatabase; onAdd: () => Promise<void> }) {
  const { t } = useI18n()
  const x = t.database
  const [state, setState] = useState<'idle' | 'busy' | 'done'>(d.exists ? 'done' : 'idle')
  const Icon = SOURCE_ICON[d.source]
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <Icon size={15} className="shrink-0 text-fg-muted" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-fg">{d.name}</span>
          <Badge color={d.type === 'postgres' ? 'accent' : 'warning'} className="py-0 text-2xs">{d.type === 'postgres' ? 'PostgreSQL' : 'MySQL'}</Badge>
          {!d.hasPassword && <Badge className="py-0 text-2xs">{x.noPassword}</Badge>}
        </span>
        <span className="truncate font-mono text-2xs text-fg-muted">
          {d.user ? `${d.user}@` : ''}{d.host}:{d.port}{d.database ? `/${d.database}` : ''} · {d.origin}
        </span>
      </div>
      {state === 'done' ? (
        <span className="flex items-center gap-1 text-xs text-success"><Check size={13} /> {x.added}</span>
      ) : (
        <Button size="sm" variant="secondary" loading={state === 'busy'}
          onClick={async () => { setState('busy'); try { await onAdd(); setState('done') } catch { setState('idle') } }}>
          {state !== 'busy' && <Plus size={13} />} {x.add}
        </Button>
      )}
    </div>
  )
}

interface Props {
  /** Scan this SSH server right away (coming from the SSH page) */
  initialServer?: string
  onClose: () => void
  onAdded: (id: string) => void
}

export default function DetectDialog({ initialServer, onClose, onAdded }: Props) {
  const { t } = useI18n()
  const x = t.database
  const toast = useToast()
  const [local, setLocal] = useState<DetectedDatabase[] | null>(null)
  const [servers, setServers] = useState<SSHConnection[]>([])
  const [server, setServer] = useState(initialServer ?? '')
  const [remote, setRemote] = useState<DetectedDatabase[] | null>(null)
  const [scanning, setScanning] = useState(false)

  const scan = useCallback(async (id: string) => {
    if (!id) return
    setScanning(true)
    setRemote(null)
    try { setRemote(await window.devforge.db.detectRemote(id)) }
    catch (err) { toast.show({ tone: 'error', title: x.scanFailed, description: String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '') }) }
    finally { setScanning(false) }
  }, [toast, x])

  useEffect(() => {
    window.devforge.db.detectLocal().then(setLocal).catch(() => setLocal([]))
    window.devforge.getSshConnections().then(list => {
      setServers(list)
      setServer(s => s || list[0]?.id || '')
    })
    if (initialServer) scan(initialServer)
  }, [initialServer, scan])

  async function add(d: DetectedDatabase) {
    const id = await window.devforge.db.addDetected(d.key)
    onAdded(id)
  }

  return (
    <Modal title={<span className="flex items-center gap-2"><Search size={16} /> {x.detectTitle}</span>} onClose={onClose} className="max-w-3xl"
      footer={<Button variant="ghost" onClick={onClose}>{t.common.close}</Button>}>
      {/* Server */}
      <section className="flex flex-col gap-2">
        <SectionTitle>{x.onServer}</SectionTitle>
        <div className="flex gap-2">
          <Select value={server} onChange={e => setServer(e.target.value)} className="flex-1">
            {servers.length === 0 && <option value="">{t.deploy.noServer}</option>}
            {servers.map(s => <option key={s.id} value={s.id}>{s.name} — {s.username}@{s.host}</option>)}
          </Select>
          <Button onClick={() => scan(server)} loading={scanning} disabled={!server}>{!scanning && <Server size={14} />} {x.scan}</Button>
        </div>
        <p className="text-xs text-fg-muted">{x.scanHint}</p>
        {scanning && <div className="flex justify-center p-3"><Spinner /></div>}
        {remote && (remote.length === 0
          ? <p className="rounded-lg border border-dashed border-line p-3 text-center text-sm text-fg-muted">{x.nothingOnServer}</p>
          : <div className="divide-y divide-line-subtle rounded-lg border border-line-subtle">{remote.map(d => <CandidateRow key={d.key} d={d} onAdd={() => add(d)} />)}</div>)}
      </section>

      {/* Projects */}
      <section className="flex flex-col gap-2">
        <SectionTitle>{x.inProjects}</SectionTitle>
        {!local ? <div className="flex justify-center p-3"><Spinner /></div>
          : local.length === 0 ? <p className="flex items-center gap-2 text-sm text-fg-muted"><Database size={14} /> {x.nothingInProjects}</p>
          : <div className="max-h-72 divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line-subtle">{local.map(d => <CandidateRow key={d.key} d={d} onAdd={() => add(d)} />)}</div>}
      </section>
    </Modal>
  )
}
