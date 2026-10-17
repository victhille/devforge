import { useCallback, useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Pencil, Plus, Rocket, Search, Server, Trash2, UploadCloud, XCircle } from 'lucide-react'
import type { DeployRun, DeployTarget, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import DeployEditor from './DeployEditor'
import DetectDeploysDialog from './DetectDeploysDialog'

function duration(run: DeployRun): string {
  if (!run.finishedAt) return ''
  const s = Math.round((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function RunLog({ text }: { text: string }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [text])
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-console p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">
      {text || '…'}
      <div ref={end} />
    </pre>
  )
}

function TargetCard({ target, connection, onEdit, onDelete }: {
  target: DeployTarget
  connection?: SSHConnection
  onEdit: () => void
  onDelete: () => void
}) {
  const { t, lang } = useI18n()
  const d = t.deploy
  const toast = useToast()
  const [runs, setRuns] = useState<DeployRun[]>([])
  const [live, setLive] = useState<{ id: string; log: string } | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const loadHistory = useCallback(() => window.devforge.deploy.history(target.id).then(setRuns), [target.id])
  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => {
    const offLog = window.devforge.deploy.onLog(e => setLive(l => (l && l.id === e.runId ? { ...l, log: l.log + e.text } : l)))
    const offStatus = window.devforge.deploy.onStatus(run => {
      if (run.targetId !== target.id || run.status === 'running') return
      loadHistory()
      setLive(l => (l?.id === run.id ? null : l))
      setOpen(run.id)
      toast.show(run.status === 'success'
        ? { tone: 'success', title: d.success.replace('{name}', target.name) }
        : { tone: 'error', title: d.failure.replace('{name}', target.name) })
    })
    return () => { offLog(); offStatus() }
  }, [target.id, target.name, loadHistory, toast, d])

  async function deploy() {
    const id = await window.devforge.deploy.run(target.id)
    setLive({ id, log: '' })
  }

  const last = runs[0]

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line-subtle px-4 py-3">
        <Server size={16} className="shrink-0" style={{ color: connection?.color }} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-fg">{target.name}</span>
          <span className="truncate font-mono text-2xs text-fg-muted">
            {connection ? `${connection.username}@${connection.host}` : d.missingServer}:{target.remotePath}
          </span>
        </div>
        {last && !live && (
          <span className={cn('flex items-center gap-1 text-xs', last.status === 'success' ? 'text-success' : 'text-danger')}>
            {last.status === 'success' ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
            {formatRelative(last.startedAt, lang)}
          </span>
        )}
        <IconButton title={d.edit} onClick={onEdit}><Pencil size={14} /></IconButton>
        <IconButton title={t.common.delete} tone="danger" onClick={onDelete}><Trash2 size={14} /></IconButton>
        <Button onClick={deploy} loading={!!live} disabled={!connection}>
          {!live && <UploadCloud size={14} />} {live ? d.deploying : d.deploy}
        </Button>
      </div>

      {live && <div className="p-4"><RunLog text={live.log} /></div>}

      {runs.length > 0 && (
        <div className="divide-y divide-line-subtle">
          {runs.slice(0, 5).map(run => (
            <div key={run.id} className="px-4 py-2">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(o => (o === run.id ? null : run.id))}>
                {open === run.id ? <ChevronDown size={13} className="text-fg-muted" /> : <ChevronRight size={13} className="text-fg-muted" />}
                {run.status === 'running' ? <Spinner /> : run.status === 'success'
                  ? <CheckCircle2 size={14} className="text-success" />
                  : <XCircle size={14} className="text-danger" />}
                <span className="flex-1 text-sm text-fg-secondary">{new Date(run.startedAt).toLocaleString(lang)}</span>
                <span className="font-mono text-xs text-fg-muted">{duration(run)}</span>
              </button>
              {open === run.id && <div className="mt-2"><RunLog text={run.log} /></div>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export default function DeployPage() {
  const { t } = useI18n()
  const d = t.deploy
  const [targets, setTargets] = useState<DeployTarget[]>([])
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [editing, setEditing] = useState<{ target?: DeployTarget } | null>(null)
  const [detecting, setDetecting] = useState(false)

  const reload = useCallback(() => window.devforge.deploy.targets().then(setTargets), [])
  useEffect(() => {
    reload()
    window.devforge.getSshConnections().then(setConnections)
  }, [reload])

  return (
    <Page>
      <PageHeader
        icon={<Rocket size={18} />}
        title={d.title}
        subtitle={d.subtitle}
        actions={
          <>
            <Button variant="secondary" onClick={() => setDetecting(true)} disabled={connections.length === 0}><Search size={14} /> {d.detectTitle}</Button>
            <Button onClick={() => setEditing({})} disabled={connections.length === 0}><Plus size={14} /> {d.newTarget}</Button>
          </>
        }
      />

      {connections.length === 0 ? (
        <EmptyState icon={<Server size={32} />} title={d.needServer} description={d.needServerHint} />
      ) : targets.length === 0 ? (
        <EmptyState icon={<UploadCloud size={32} />} title={d.emptyTitle} description={d.emptyHint}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setDetecting(true)}><Search size={14} /> {d.detectTitle}</Button>
              <Button variant="secondary" onClick={() => setEditing({})}><Plus size={14} /> {d.newTarget}</Button>
            </div>
          } />
      ) : (
        <div className="flex flex-col gap-4">
          {targets.map(target => (
            <TargetCard
              key={target.id}
              target={target}
              connection={connections.find(c => c.id === target.connectionId)}
              onEdit={() => setEditing({ target })}
              onDelete={async () => {
                if (!window.confirm(d.deleteConfirm.replace('{name}', target.name))) return
                await window.devforge.deploy.remove(target.id)
                reload()
              }}
            />
          ))}
        </div>
      )}

      {detecting && <DetectDeploysDialog existing={targets} onClose={() => setDetecting(false)} onCreated={reload} />}

      {editing && (
        <DeployEditor
          initial={editing.target}
          onClose={() => setEditing(null)}
          onSave={async target => { await window.devforge.deploy.save(target); await reload(); setEditing(null) }}
        />
      )}
    </Page>
  )
}
