import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AlertTriangle, ArchiveRestore, CheckCircle2, FolderOpen, HardDriveDownload, Play, Power, Settings2, ShieldAlert } from 'lucide-react'
import type { BackupCandidates, BackupPlan, BackupState, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card, { CardHeader, CardTitle } from '@renderer/components/ui/Card'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import Checkbox from '@renderer/components/ui/Checkbox'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from './ServerPicker'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import Notice from '@renderer/components/ui/Notice'
import LogBox from '@renderer/components/ui/LogBox'
import Stat, { StatRow } from '@renderer/components/ui/Stat'

/** Same threshold as the main process' warning */
const STALE_HOURS = 36

export default function BackupsPage() {
  const { t } = useI18n()
  const { connections, conn, serverId, setServerId } = useServerPicker()
  return (
    <Page>
      <PageHeader crumb={conn ? `${t.nav.groupServers} · ${conn.name}` : t.nav.groupServers} title={t.nav.backups} subtitle={t.backups.subtitle} actions={<ServerSelect connections={connections} value={serverId} onChange={setServerId} />} />
      {!connections ? <Spinner /> : !conn ? <NeedsSetup service="server" /> : <Backups key={conn.id} conn={conn} />}
    </Page>
  )
}


function Backups({ conn }: { conn: SSHConnection }) {
  const { t, lang } = useI18n()
  const b = t.backups
  const toast = useToast()
  const [st, setSt] = useState<BackupState | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useState('')
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = useCallback(() => {
    setError('')
    return window.devforge.backups.state(conn.id).then(setSt).catch(err => setError(errorText(err)))
  }, [conn.id])
  useEffect(() => { load() }, [load])
  useEffect(() => window.devforge.backups.onLog(e => { if (e.connectionId === conn.id) setLog(l => (l + e.text).slice(-40_000)) }), [conn.id])

  async function run(key: string, fn: () => Promise<{ ok: boolean } | unknown>, ok?: string) {
    setBusy(key); setLog('')
    try {
      const r = await fn()
      const success = !(r && typeof r === 'object' && 'ok' in r && !(r as { ok: boolean }).ok)
      if (success && ok) toast.show({ tone: 'success', title: ok })
      if (!success) toast.show({ tone: 'error', title: b.failed })
      return success
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) }); return false }
    finally { setBusy(null); load() }
  }

  if (error) return <Card className="p-4.5 text-sm text-danger">{error}</Card>
  if (!st) return <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {b.loading}</p>

  const plan = st.plan
  const last = st.last
  const ageH = last ? (Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000 : 0
  const level = !last ? 'none' : !last.ok ? 'bad' : ageH > STALE_HOURS ? 'warn' : 'ok'

  return (
    <div className="flex flex-col gap-4">
      {(!plan || editing) ? (
        <Setup conn={conn} plan={plan} busy={busy === 'save'} onCancel={plan ? () => setEditing(false) : undefined}
          onSave={async p => { if (await run('save', () => window.devforge.backups.save(p), b.saved)) setEditing(false) }} />
      ) : (
        <Card className="df-rise flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center gap-4">
            <div className={cn('flex size-12 items-center justify-center rounded-card',
              level === 'ok' ? 'bg-success-soft text-success' : level === 'bad' ? 'bg-danger-soft text-danger' : level === 'warn' ? 'bg-warning-soft text-warning' : 'bg-active text-fg-muted')}>
              {level === 'ok' ? <CheckCircle2 size={24} /> : level === 'bad' ? <ShieldAlert size={24} /> : level === 'warn' ? <AlertTriangle size={24} /> : <HardDriveDownload size={24} />}
            </div>
            <div className="min-w-[240px] flex-1">
              <h2 className="font-display text-lg font-bold tracking-[-.01em] text-fg">{b.last}</h2>
              <div className="text-base text-fg-secondary">
                {!last ? b.never.replace('{time}', plan.time)
                  : last.ok ? b.lastOk.replace('{when}', formatRelative(last.finishedAt, lang)).replace('{size}', formatSize(last.size, lang))
                  : b.lastFailed.replace('{when}', formatRelative(last.finishedAt, lang))}
              </div>
              <div className="mt-0.5 text-xs text-fg-muted">{b.schedule.replace('{time}', plan.time).replace('{daily}', String(plan.keepDaily)).replace('{weekly}', String(plan.keepWeekly))}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button loading={busy === 'run'} onClick={() => run('run', () => window.devforge.backups.runNow(conn.id), b.runOk)}>{busy !== 'run' && <Play size={14} />} {b.runNow}</Button>
              <Button variant="ghost" onClick={() => setEditing(true)}><Settings2 size={14} /> {b.edit}</Button>
            </div>
          </div>
          {level === 'warn' && <Notice tone="warning">{b.stale.replace('{hours}', String(STALE_HOURS))}</Notice>}
          {!st.scheduled && <Notice tone="warning">{b.notScheduled}</Notice>}
          {last && last.items.filter(i => !i.ok).map(i => <p key={i.name} className="text-base text-danger">{b.itemFailed.replace('{name}', i.name).replace('{error}', i.error)}</p>)}
          {plan.localDir && (
            <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3 text-base text-fg-secondary">
              <HardDriveDownload size={15} className="text-fg-muted" />
              <span className="min-w-[200px] flex-1">
                {st.local.error ? <span className="text-danger">{b.localCopyError.replace('{error}', st.local.error)}</span>
                  : st.local.day ? b.localCopy.replace('{day}', st.local.day) : b.localCopyNone}
              </span>
              <Button size="sm" variant="secondary" loading={busy === 'copy'} onClick={() => run('copy', async () => {
                const r = await window.devforge.backups.copyNow(conn.id)
                toast.show({ tone: 'success', title: r.day ? b.copied.replace('{day}', r.day) : b.upToDate })
              })}>{b.copyNow}</Button>
              <Button size="sm" variant="ghost" onClick={() => window.devforge.backups.openLocalDir(conn.id)}><FolderOpen size={13} /> {b.openDir}</Button>
            </div>
          )}
        </Card>
      )}

      {plan && !editing && (
        <StatRow>
          <Stat label={b.statNext} value={plan.time} unit={b.statNextUnit} />
          <Stat label={b.statKept} value={new Set(st.files.map(f => f.day)).size}
            unit={b.statKeptUnit.replace('{size}', formatSize(st.files.reduce((n, f) => n + f.size, 0), lang))} />
        </StatRow>
      )}

      {(busy || log) && <LogBox title={b.journal} text={log} running={!!busy} />}

      {plan && !editing && (
        <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
          <CardHeader><CardTitle>{b.files}</CardTitle></CardHeader>
          {st.files.length === 0 ? <p className="px-4 py-4 text-sm text-fg-muted">{b.noFiles}</p> : (
            <FileList files={st.files} disabled={!!busy} onRestore={setRestoring} />
          )}
        </Card>
      )}

      {plan && !editing && (
        <button onClick={async () => { if ((await confirmDialog(b.disableConfirm.replace('{name}', conn.name), { danger: true }))) run('off', () => window.devforge.backups.disable(conn.id), b.savedOff) }}
          className="flex items-center gap-1.5 self-start text-xs text-fg-muted hover:text-danger"><Power size={12} /> {b.disable}</button>
      )}

      {restoring && (() => {
        const m = /^(daily|weekly)\/(\d{4}-\d{2}-\d{2})\/(db|vol)-(.+)\.(sql|tar)\.gz$/.exec(restoring)
        const name = m?.[4] ?? restoring
        return (
          <Modal title={b.restoreTitle.replace('{name}', name)} onClose={() => setRestoring(null)}
            footer={<>
              <Button variant="ghost" onClick={() => setRestoring(null)}>{b.cancel}</Button>
              <Button variant="danger" onClick={() => { const p = restoring; setRestoring(null); run('restore', () => window.devforge.backups.restore(conn.id, p), b.restoreOk) }}>
                <ArchiveRestore size={14} /> {b.restore}
              </Button>
            </>}>
            <p className="text-base text-fg-secondary">{(m?.[3] === 'db' ? b.restoreDb : b.restoreVol).replace('{day}', m?.[2] ?? '')}</p>
            <p className="text-base text-fg-secondary">{b.restoreStop}</p>
          </Modal>
        )
      })()}
    </div>
  )
}

function FileList({ files, disabled, onRestore }: { files: BackupState['files']; disabled: boolean; onRestore: (path: string) => void }) {
  const { t, lang } = useI18n()
  const b = t.backups
  return (
    <Table>
      <thead>
        <tr>
          <Th>{b.colDate}</Th>
          <Th>{b.colFile}</Th>
          <Th align="right">{b.colSize}</Th>
          <Th><span className="sr-only">{b.restore}</span></Th>
        </tr>
      </thead>
      <tbody>
        {files.map(f => (
          <tr key={f.path}>
            <Td className="whitespace-nowrap">
              <span className="flex items-center gap-2 font-medium text-fg">{f.day} <Badge mono>{f.kind === 'weekly' ? b.weekly : b.daily}</Badge></span>
            </Td>
            <Td className="w-full max-w-0 truncate font-mono text-xs text-fg-secondary" title={f.path}>{f.path.split('/').pop()}</Td>
            <Td align="right" className="font-mono text-xs whitespace-nowrap text-fg-muted">{formatSize(f.size, lang)}</Td>
            <Td align="right"><Button size="sm" variant="ghost" disabled={disabled} onClick={() => onRestore(f.path)}><ArchiveRestore size={13} /> {b.restore}</Button></Td>
          </tr>
        ))}
      </tbody>
    </Table>
  )
}

function Setup({ conn, plan, busy, onSave, onCancel }: {
  conn: SSHConnection
  plan: BackupPlan | null
  busy: boolean
  onSave: (p: Omit<BackupPlan, 'savedAt'>) => void
  onCancel?: () => void
}) {
  const { t } = useI18n()
  const b = t.backups
  const [cands, setCands] = useState<BackupCandidates | null>(null)
  const [error, setError] = useState('')
  const [dbs, setDbs] = useState<Set<string>>(new Set(plan?.databases.map(d => d.container) ?? []))
  const [vols, setVols] = useState<Set<string>>(new Set(plan?.volumes ?? []))
  const [time, setTime] = useState(plan?.time ?? '03:30')
  const [keepDaily, setKeepDaily] = useState(plan?.keepDaily ?? 7)
  const [keepWeekly, setKeepWeekly] = useState(plan?.keepWeekly ?? 4)
  const [localDir, setLocalDir] = useState(plan?.localDir ?? '')

  useEffect(() => {
    window.devforge.backups.candidates(conn.id).then(c => {
      setCands(c)
      // First setup: every database, every volume or folder that is not a database's own data
      if (!plan) {
        setDbs(new Set(c.databases.map(d => d.container)))
        setVols(new Set(c.volumes.filter(v => !v.databaseData).map(v => v.name)))
      }
    }).catch(err => setError(errorText(err)))
  }, [conn.id, plan])

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, v: string) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); setter(n) }
  const empty = dbs.size + vols.size === 0

  return (
    <Card className="df-rise flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-forgy-soft text-forgy"><HardDriveDownload size={21} /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-fg">{b.setupTitle}</h2>
          <p className="mt-0.5 text-sm text-fg-secondary">{b.setupHint}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : !cands ? <Spinner /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-base font-medium text-fg">{b.databases}</legend>
            {cands.databases.length === 0 && <p className="text-xs text-fg-muted">{b.noDatabases}</p>}
            {cands.databases.map(d => (
              <Checkbox key={d.container} checked={dbs.has(d.container)} onChange={() => toggle(dbs, setDbs, d.container)} className="items-start gap-2.5 text-base text-fg">
                <span className="min-w-0"><span className="font-medium">{d.container}</span> <span className="font-mono text-xs text-fg-muted">{d.image}</span></span>
              </Checkbox>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-base font-medium text-fg">{b.volumes}</legend>
            {cands.volumes.length === 0 && <p className="text-xs text-fg-muted">{b.noVolumes}</p>}
            {cands.volumes.map(v => (
              <Checkbox key={v.name} checked={vols.has(v.name)} onChange={() => toggle(vols, setVols, v.name)} className="items-start gap-2.5 text-base text-fg">
                <span className="min-w-0">
                  <span className="break-all font-mono text-xs">{v.name}</span>
                  <span className="block text-xs text-fg-muted">{v.databaseData ? b.coveredByDump : b.usedBy.replace('{names}', v.usedBy.join(', '))}</span>
                </span>
              </Checkbox>
            ))}
          </fieldset>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{b.time}
          <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{b.keepDaily}
          <Input type="number" min={1} max={60} value={keepDaily} onChange={e => setKeepDaily(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{b.keepWeekly}
          <Input type="number" min={1} max={52} value={keepWeekly} onChange={e => setKeepWeekly(Number(e.target.value))} />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-base text-fg-secondary">{b.localDir}</span>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('min-w-0 flex-1 truncate rounded-control border border-line bg-canvas px-3 py-2 font-mono text-xs', localDir ? 'text-fg' : 'text-fg-muted')}>{localDir || b.localDirNone}</span>
          <Button variant="secondary" onClick={async () => { const d = await window.devforge.backups.chooseLocalDir(); if (d) setLocalDir(d) }}>{b.choose}</Button>
          {localDir && <Button variant="ghost" onClick={() => setLocalDir('')}>{b.clear}</Button>}
        </div>
        <span className="text-xs text-fg-muted">{b.localDirHint}</span>
      </div>

      {empty && cands && <p className="text-base text-warning">{b.nothing}</p>}
      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="ghost" onClick={onCancel}>{b.cancel}</Button>}
        <Button disabled={!cands || empty} loading={busy} onClick={() => onSave({
          connectionId: conn.id,
          databases: (cands?.databases ?? []).filter(d => dbs.has(d.container)).map(d => ({ engine: d.engine, container: d.container })),
          volumes: [...vols], time, keepDaily, keepWeekly, localDir
        })}>{plan ? b.saveChanges : b.enable}</Button>
      </div>
    </Card>
  )
}
