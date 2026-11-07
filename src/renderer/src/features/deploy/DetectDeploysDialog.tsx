import { useCallback, useEffect, useState } from 'react'
import { Check, FolderGit2, Link2, Plus, Server } from 'lucide-react'
import type { DeployTarget, DetectedDeploy, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Select } from '@renderer/components/ui/Input'
import { errorText } from '@renderer/lib/errors'

interface Props {
  existing: DeployTarget[]
  onClose: () => void
  onCreated: () => void
}

export default function DetectDeploysDialog({ existing, onClose, onCreated }: Props) {
  const { t } = useI18n()
  const d = t.deploy
  const toast = useToast()
  const [servers, setServers] = useState<SSHConnection[]>([])
  const [server, setServer] = useState('')
  const [found, setFound] = useState<DetectedDeploy[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [created, setCreated] = useState<Set<string>>(new Set())

  const scan = useCallback(async (id: string) => {
    if (!id) return
    setScanning(true)
    setFound(null)
    try { setFound(await window.devforge.deploy.detect(id)) }
    catch (err) { toast.show({ tone: 'error', title: d.scanFailed, description: errorText(err) }) }
    finally { setScanning(false) }
  }, [toast, d])

  useEffect(() => {
    window.devforge.getSshConnections().then(list => {
      setServers(list)
      if (list[0]) { setServer(list[0].id); scan(list[0].id) }
    })
  }, [scan])

  async function create(f: DetectedDeploy) {
    const conn = servers.find(s => s.id === server)
    const folder = f.remotePath.split('/').pop() ?? f.remotePath
    await window.devforge.deploy.save({
      id: crypto.randomUUID(),
      name: `${f.projectName ?? folder} → ${conn?.name ?? 'server'}`,
      connectionId: server,
      remotePath: f.remotePath,
      script: f.script,
      projectPath: f.projectPath ?? undefined,
      pushFirst: !!f.projectPath
    })
    setCreated(prev => new Set(prev).add(f.remotePath))
    onCreated()
  }

  const isKnown = (f: DetectedDeploy) => created.has(f.remotePath) || existing.some(e => e.connectionId === server && e.remotePath === f.remotePath)

  return (
    <Modal title={<span className="flex items-center gap-2"><Server size={16} /> {d.detectTitle}</span>} onClose={onClose} className="max-w-3xl"
      footer={<Button variant="ghost" onClick={onClose}>{t.common.close}</Button>}>
      <div className="flex gap-2">
        <Select value={server} onChange={e => setServer(e.target.value)} className="flex-1">
          {servers.map(s => <option key={s.id} value={s.id}>{s.name} — {s.username}@{s.host}</option>)}
        </Select>
        <Button onClick={() => scan(server)} loading={scanning} disabled={!server}>{d.scan}</Button>
      </div>
      <p className="text-xs text-fg-muted">{d.detectHint}</p>

      {scanning && <div className="flex justify-center p-4"><Spinner /></div>}
      {found && found.length === 0 && <p className="rounded-lg border border-dashed border-line p-4 text-center text-sm text-fg-muted">{d.nothingFound}</p>}
      {found && found.length > 0 && (
        <div className="max-h-[50vh] divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line-subtle">
          {found.map(f => (
            <div key={f.remotePath} className="flex items-center gap-3 px-3 py-2.5">
              <FolderGit2 size={16} className="shrink-0 text-fg-muted" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-fg">{f.remotePath}</span>
                  <Badge color="accent" className="py-0 text-2xs">{f.preset}</Badge>
                  {f.branch && <Badge className="py-0 font-mono text-2xs">{f.branch}</Badge>}
                </span>
                <span className="flex items-center gap-1 truncate text-2xs text-fg-muted">
                  {f.projectName
                    ? <><Link2 size={10} className="text-success" /> <span className="text-success">{f.projectName}</span> · </>
                    : null}
                  {f.origin ?? d.noOrigin}
                </span>
              </div>
              {isKnown(f) ? (
                <span className="flex items-center gap-1 text-xs text-success"><Check size={13} /> {d.created}</span>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => create(f)}><Plus size={13} /> {d.createTarget}</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
