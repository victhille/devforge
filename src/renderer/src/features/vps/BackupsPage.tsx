import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { CardSkeleton, LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { Clock, FolderOpen, HardDriveDownload, Play, Power, RotateCcw } from 'lucide-react'
import type { BackupCandidates, BackupPlan, BackupState, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import Checkbox from '@renderer/components/ui/Checkbox'
import Modal from '@renderer/components/ui/Modal'
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
  const picker = useServerPicker()
  const { connections, conn } = picker
  // The header comes with the plan (Schedule, Back up now)
  if (connections && conn) return <Page className="df-mockup"><Backups key={conn.id} conn={conn} picker={picker} /></Page>
  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupServers} title={t.nav.backups} subtitle={t.backups.subtitle} />
      {!connections ? <CardSkeleton rows={3} /> : <NeedsSetup service="server" />}
    </Page>
  )
}

/** « 03:00 » from a date: the time a backup finished */
const timeOf = (iso: string, lang: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })

function Backups({ conn, picker }: { conn: SSHConnection; picker: ReturnType<typeof useServerPicker> }) {
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

  const plan = st?.plan ?? null
  const showing = !!plan && !editing
  // As in the mock-up: where it is, then Schedule and Back up now
  const header = (
    <PageHeader crumb={`${t.nav.groupServers} · ${conn.name}`} title={t.nav.backups} subtitle={b.subtitle}
      actions={<>
        <ServerSelect connections={picker.connections} value={picker.serverId} onChange={picker.setServerId} />
        {showing && <Button variant="secondary" onClick={() => setEditing(true)}><Clock size={14} aria-hidden /> {b.plan}</Button>}
        {showing && <Button loading={busy === 'run'} onClick={() => run('run', () => window.devforge.backups.runNow(conn.id), b.runOk)}>{busy !== 'run' && <Play size={14} aria-hidden />} {b.runNow}</Button>}
      </>} />
  )

  if (error) return <>{header}<Card className="p-4.5 text-sm text-danger">{error}</Card></>
  if (!st) return <>{header}<CardSkeleton label={b.loading} rows={3} /></>

  const last = st.last
  const ageH = last ? (Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000 : 0
  const level = !last ? 'none' : !last.ok ? 'bad' : ageH > STALE_HOURS ? 'warn' : 'ok'
  const days = new Set(st.files.map(f => f.day)).size

  return (
    <>
      {header}
      {(!plan || editing) && (
        <Setup conn={conn} plan={plan} busy={busy === 'save'} onCancel={plan ? () => setEditing(false) : undefined}
          onSave={async p => { if (await run('save', () => window.devforge.backups.save(p), b.saved)) setEditing(false) }} />
      )}

      {plan && showing && (
        <StatRow className="df-rise">
          <Stat label={b.statLast} value={last ? timeOf(last.finishedAt, lang) : '—'}
            unit={!last ? b.statLastNone : (last.ok ? b.statLastOk : b.statLastFailed).replace('{when}', formatRelative(last.finishedAt, lang))}
            tone={level === 'bad' ? 'danger' : level === 'warn' ? 'warning' : undefined} />
          <Stat label={b.statNext} value={plan.time} unit={b.statNextUnit} />
          <Stat label={b.statKept} value={days} unit={b.statKeptUnit.replace('{size}', formatSize(st.files.reduce((n, f) => n + f.size, 0), lang))} />
        </StatRow>
      )}

      {showing && level === 'warn' && <Notice tone="warning">{b.stale.replace('{hours}', String(STALE_HOURS))}</Notice>}
      {showing && !st.scheduled && <Notice tone="warning">{b.notScheduled}</Notice>}
      {showing && last && last.items.filter(i => !i.ok).map(i => <p key={i.name} className="text-base text-danger">{b.itemFailed.replace('{name}', i.name).replace('{error}', i.error)}</p>)}

      {(busy || log) && <LogBox title={b.journal} text={log} running={!!busy} />}

      {showing && (
        <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
          {st.files.length === 0 ? <p className="px-4 py-4 text-sm text-fg-muted">{b.noFiles}</p> : (
            <FileList files={st.files} disabled={!!busy} onRestore={setRestoring} />
          )}
        </Card>
      )}

      {/* Its copy on this PC, when it has a folder */}
      {showing && plan.localDir && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
          <HardDriveDownload size={14} aria-hidden className="text-fg-muted" />
          <span className="min-w-[200px] flex-1">
            {st.local.error ? <span className="text-danger">{b.localCopyError.replace('{error}', st.local.error)}</span>
              : st.local.day ? b.localCopy.replace('{day}', st.local.day) : b.localCopyNone}
          </span>
          <Button size="sm" variant="secondary" loading={busy === 'copy'} onClick={() => run('copy', async () => {
            const r = await window.devforge.backups.copyNow(conn.id)
            toast.show({ tone: 'success', title: r.day ? b.copied.replace('{day}', r.day) : b.upToDate })
          })}>{b.copyNow}</Button>
          <Button size="sm" variant="ghost" onClick={() => window.devforge.backups.openLocalDir(conn.id)}><FolderOpen size={13} aria-hidden /> {b.openDir}</Button>
        </div>
      )}

      {showing && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 text-xs text-fg-muted">{b.restoreNote}</p>
          <button onClick={async () => { if ((await confirmDialog(b.disableConfirm.replace('{name}', conn.name), { danger: true }))) run('off', () => window.devforge.backups.disable(conn.id), b.savedOff) }}
            className="flex items-center gap-1.5 text-xs text-fg-muted hover:text-danger"><Power size={12} aria-hidden /> {b.disable}</button>
        </div>
      )}

      {restoring && (() => {
        const m = /^(daily|weekly)\/(\d{4}-\d{2}-\d{2})\/(db|vol)-(.+)\.(sql|tar)\.gz$/.exec(restoring)
        const name = m?.[4] ?? restoring
        return (
          <Modal title={b.restoreTitle.replace('{name}', name)} onClose={() => setRestoring(null)}
            footer={<>
              <Button variant="ghost" onClick={() => setRestoring(null)}>{b.cancel}</Button>
              <Button variant="danger" onClick={() => { const p = restoring; setRestoring(null); run('restore', () => window.devforge.backups.restore(conn.id, p), b.restoreOk) }}>
                <RotateCcw size={14} aria-hidden /> {b.restore}
              </Button>
            </>}>
            <p className="text-base text-fg-secondary">{(m?.[3] === 'db' ? b.restoreDb : b.restoreVol).replace('{day}', m?.[2] ?? '')}</p>
            <p className="text-base text-fg-secondary">{b.restoreStop}</p>
          </Modal>
        )
      })()}
    </>
  )
}

function FileList({ files, disabled, onRestore }: { files: BackupState['files']; disabled: boolean; onRestore: (path: string) => void }) {
  const { t, lang } = useI18n()
  const b = t.backups
  // « 8 nov. » from 2026-11-08 (read as a local day, not UTC midnight)
  const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short' })
  const content = (path: string) => {
    const m = /\/(db|vol)-(.+)\.(sql|tar)\.gz$/.exec(path)
    return m ? (m[1] === 'db' ? b.contentDb : b.contentVol).replace('{name}', m[2]!) : path.split('/').pop() ?? path
  }
  return (
    <Table>
      <thead>
        <tr>
          <Th>{b.colDate}</Th>
          <Th>{b.colContent}</Th>
          <Th align="right">{b.colSize}</Th>
          <Th align="right"><span className="sr-only">{b.restore}</span></Th>
        </tr>
      </thead>
      <tbody>
        {files.map(f => (
          <tr key={f.path}>
            <Td className="whitespace-nowrap">
              <span className="flex items-center gap-2 font-semibold text-fg">{dayLabel(f.day)} {f.kind === 'weekly' && <Badge mono>{b.weekly}</Badge>}</span>
            </Td>
            <Td className="w-full max-w-0 truncate text-fg-secondary" title={f.path}>{content(f.path)}</Td>
            <Td align="right" className="font-mono whitespace-nowrap text-fg">{formatSize(f.size, lang)}</Td>
            <Td align="right"><Button size="sm" variant="ghost" disabled={disabled} onClick={() => onRestore(f.path)}><RotateCcw size={13} aria-hidden /> {b.restore}</Button></Td>
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

      {error ? <p className="text-sm text-danger">{error}</p> : !cands ? <LinesSkeleton lines={3} /> : (
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
