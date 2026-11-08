import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Pencil, Plus, ScrollText, Search, Server, Trash2, UploadCloud, X } from 'lucide-react'
import type { DeployRun, DeployTarget, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import Spinner from '@renderer/components/ui/Spinner'
import { Select } from '@renderer/components/ui/Input'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import LogBox from '@renderer/components/ui/LogBox'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import DeployEditor from './DeployEditor'
import DetectDeploysDialog from './DetectDeploysDialog'
import { deployMethod, deploySteps, shortDuration, stepStates, type StepState } from './deploySteps'

/** The run under way, followed from its first line */
interface Live { id: string; targetId: string; startedAt: string; log: string }

const runMs = (r: DeployRun) => (r.finishedAt ? new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime() : 0)

/**
 * As in the mock-up: the deploy under way (or the last one) with its steps and
 * its log, then every target in a table with its last deploy and « Deploy ».
 */
export default function DeployPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const d = t.deploy
  const toast = useToast()
  const [targets, setTargets] = useState<DeployTarget[] | null>(null)
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [runs, setRuns] = useState<Record<string, DeployRun[]>>({})
  const [live, setLive] = useState<Live | null>(null)
  const [focus, setFocus] = useState<{ targetId: string; runId?: string } | null>(null)
  const [editing, setEditing] = useState<{ target?: DeployTarget } | null>(null)
  const [detecting, setDetecting] = useState(false)

  const loadRuns = useCallback(async (list: DeployTarget[]) => {
    const all = await Promise.all(list.map(async tg => [tg.id, await window.devforge.deploy.history(tg.id)] as const))
    setRuns(Object.fromEntries(all))
  }, [])
  const reload = useCallback(async () => {
    const list = await window.devforge.deploy.targets()
    setTargets(list)
    await loadRuns(list)
  }, [loadRuns])
  useEffect(() => {
    reload()
    window.devforge.getSshConnections().then(setConnections).catch(() => {})
  }, [reload])

  // The run is followed by its events: its lines, then its end
  useEffect(() => {
    const offLog = window.devforge.deploy.onLog(e => setLive(l => (l && l.id === e.runId ? { ...l, log: l.log + e.text } : l)))
    const offStatus = window.devforge.deploy.onStatus(run => {
      if (run.status === 'running') {
        setLive(l => (l?.id === run.id ? l : { id: run.id, targetId: run.targetId, startedAt: run.startedAt, log: '' }))
        setFocus({ targetId: run.targetId })
        return
      }
      setLive(l => (l?.id === run.id ? null : l))
      setFocus({ targetId: run.targetId, runId: run.id })
      window.devforge.deploy.history(run.targetId).then(list => setRuns(r => ({ ...r, [run.targetId]: list }))).catch(() => {})
      const name = targets?.find(x => x.id === run.targetId)?.name ?? ''
      toast.show(run.status === 'success'
        ? { tone: 'success', title: d.success.replace('{name}', name) }
        : { tone: 'error', title: d.failure.replace('{name}', name) })
    })
    return () => { offLog(); offStatus() }
  }, [targets, toast, d])

  async function deploy(target: DeployTarget) {
    const id = await window.devforge.deploy.run(target.id)
    setLive(l => (l?.id === id ? l : { id, targetId: target.id, startedAt: new Date().toISOString(), log: '' }))
    setFocus({ targetId: target.id })
  }

  async function remove(target: DeployTarget) {
    if (!(await confirmDialog(d.deleteConfirm.replace('{name}', target.name), { danger: true }))) return
    await window.devforge.deploy.remove(target.id)
    if (focus?.targetId === target.id) setFocus(null)
    reload()
  }

  // The card on top: the run under way, else the one asked for, else the latest of all
  const shown = useMemo(() => {
    if (!targets) return null
    if (live) return { targetId: live.targetId, runId: live.id }
    if (focus) return focus
    const latest = Object.values(runs).flat().sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
    return latest ? { targetId: latest.targetId, runId: latest.id } : null
  }, [targets, live, focus, runs])
  const shownTarget = targets?.find(x => x.id === shown?.targetId)
  const connOf = (tg: DeployTarget) => connections.find(c => c.id === tg.connectionId)

  return (
    <Page className="df-mockup">
      <PageHeader
        crumb={t.nav.groupOnline}
        title={d.title}
        subtitle={d.subtitle}
        actions={<>
          <Button variant="secondary" onClick={() => setDetecting(true)} disabled={connections.length === 0}>{d.detectTitle}</Button>
          <Button onClick={() => setEditing({})} disabled={connections.length === 0}><Plus size={14} aria-hidden /> {d.newTarget}</Button>
        </>}
      />

      {!targets ? <Spinner /> : connections.length === 0 && targets.length === 0 ? (
        <EmptyState icon={<Server size={32} />} title={d.needServer} description={d.needServerHint}
          action={<Button onClick={() => navigate('/ssh')}><Plus size={14} aria-hidden /> {t.ssh.addServer}</Button>} />
      ) : targets.length === 0 ? (
        <EmptyState icon={<UploadCloud size={32} />} title={d.emptyTitle} description={d.emptyHint}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setDetecting(true)}><Search size={14} aria-hidden /> {d.detectTitle}</Button>
              <Button variant="secondary" onClick={() => setEditing({})}><Plus size={14} aria-hidden /> {d.newTarget}</Button>
            </div>
          } />
      ) : (
        <>
          {shownTarget && (
            <RunCard
              key={shownTarget.id}
              target={shownTarget}
              connection={connOf(shownTarget)}
              runs={runs[shownTarget.id] ?? []}
              live={live?.targetId === shownTarget.id ? live : null}
              runId={shown?.runId}
              onPick={runId => setFocus({ targetId: shownTarget.id, runId })}
            />
          )}

          <Card>
            <Table>
              <thead>
                <tr>
                  <Th>{d.colTarget}</Th>
                  <Th>{d.colServer}</Th>
                  <Th>{d.colMethod}</Th>
                  <Th>{d.colLast}</Th>
                  <Th align="right">{d.colActions}</Th>
                </tr>
              </thead>
              <tbody>
                {targets.map(tg => {
                  const conn = connOf(tg)
                  const last = runs[tg.id]?.[0]
                  const running = live?.targetId === tg.id
                  return (
                    <tr key={tg.id} aria-current={shown?.targetId === tg.id ? 'true' : undefined}>
                      <Td className="min-w-[180px]">
                        <span className="block font-semibold text-fg">{tg.name}</span>
                        <span className="block truncate font-mono text-xs text-fg-muted" title={tg.remotePath}>{tg.remotePath}</span>
                      </Td>
                      <Td className="font-mono whitespace-nowrap text-fg-secondary">{conn?.name ?? <span className="text-danger">{d.missingServer}</span>}</Td>
                      <Td className="whitespace-nowrap text-fg-secondary">{d.method[deployMethod(tg.script)]}</Td>
                      <Td className="whitespace-nowrap">
                        {running ? <Badge color="warning"><Spinner className="size-3" /> {d.running}</Badge>
                          : last ? <LastRun run={last} />
                          : <span className="text-fg-muted">{d.never}</span>}
                      </Td>
                      <Td align="right" className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {last && !running && (
                            <Button size="sm" variant="ghost" aria-label={d.showLogOf.replace('{name}', tg.name)} onClick={() => setFocus({ targetId: tg.id, runId: last.id })}><ScrollText size={13} aria-hidden /> {d.showLog}</Button>
                          )}
                          {/* One orange button, as in the mock-up: the target on show; the others stay quiet */}
                          <Button size="sm" variant={shown?.targetId === tg.id ? 'primary' : 'secondary'} aria-label={d.deployOf.replace('{name}', tg.name)}
                            loading={running} disabled={!conn || running} onClick={() => deploy(tg)}>
                            {!running && <UploadCloud size={13} aria-hidden />} {running ? d.deploying : d.deploy}
                          </Button>
                          <MoreMenu size="sm" label={d.moreOf.replace('{name}', tg.name)} items={[
                            { label: d.edit, icon: Pencil, onSelect: () => setEditing({ target: tg }) },
                            { label: t.common.delete, icon: Trash2, danger: true, onSelect: () => remove(tg) }
                          ]} />
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}

      {detecting && <DetectDeploysDialog existing={targets ?? []} onClose={() => setDetecting(false)} onCreated={reload} />}

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

/** « réussi · hier 18:04 · 1 min 12 » */
function LastRun({ run }: { run: DeployRun }) {
  const { t, lang } = useI18n()
  const d = t.deploy
  const ok = run.status === 'success'
  return (
    <span className="inline-flex items-center gap-2">
      <Badge color={ok ? 'success' : 'danger'}>{ok ? d.ok : d.failed}</Badge>
      <span className="text-fg-secondary">{formatRelative(run.startedAt, lang)}{run.finishedAt ? ` · ${shortDuration(runMs(run), d.units)}` : ''}</span>
    </span>
  )
}

const STEP_STYLE: Record<StepState, string> = {
  done: 'border-success/35',
  running: 'border-accent bg-accent-soft',
  failed: 'border-danger/45 bg-danger-soft',
  pending: 'border-line-subtle'
}

/** The run of a target: its steps from its script, its log; the earlier runs a click away */
function RunCard({ target, connection, runs, live, runId, onPick }: {
  target: DeployTarget
  connection?: SSHConnection
  runs: DeployRun[]
  live: Live | null
  runId?: string
  onPick: (runId: string) => void
}) {
  const { t, lang } = useI18n()
  const d = t.deploy
  const run = live ? null : runs.find(r => r.id === runId) ?? runs[0]
  const status = live ? 'running' : run?.status ?? 'running'
  const log = live ? live.log : run?.log ?? ''
  const steps = useMemo(() => deploySteps(target), [target])
  const states = stepStates(log, steps, status)

  // The time of the run under way, every second
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [live])
  const elapsed = live ? Math.max(0, now - new Date(live.startedAt).getTime()) : 0
  const clock = `${Math.floor(elapsed / 60_000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, '0')}`

  if (!live && !run) return null
  return (
    <Card className={cn('flex flex-col gap-4 p-4.5', live ? 'border-accent/40' : status === 'failed' && 'border-danger/30')}>
      <div className="flex flex-wrap items-center gap-3">
        <UploadCloud size={16} aria-hidden className={live ? 'text-accent' : status === 'failed' ? 'text-danger' : 'text-success'} />
        <h2 className="min-w-0 flex-1 truncate font-display text-md font-bold tracking-[-.01em] text-fg">
          {target.name} → {connection?.name ?? d.missingServer}
        </h2>
        {!live && runs.length > 1 && (
          <Select aria-label={d.pickRun} value={run?.id ?? ''} onChange={e => onPick(e.target.value)} className="h-7.5 w-auto text-xs">
            {runs.map(r => <option key={r.id} value={r.id}>{new Date(r.startedAt).toLocaleString(lang)} · {r.status === 'success' ? d.ok : d.failed}</option>)}
          </Select>
        )}
        {/* The state is announced once; the clock that ticks every second stays out of the announcement */}
        {live ? <Badge color="warning"><Spinner className="size-3" /> <span role="status">{d.running}</span><span aria-hidden> · {clock}</span></Badge>
          : run && <Badge color={status === 'success' ? 'success' : 'danger'}>{status === 'success' ? d.ok : d.failed} · {formatRelative(run.startedAt, lang)}</Badge>}
      </div>

      {steps.length > 0 && (
        <ol aria-label={d.steps} className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
          {steps.map((s, i) => {
            const st = states[i]
            return (
              <li key={i} className={cn('flex min-w-0 flex-col gap-1 rounded-control border px-3 py-2.5', STEP_STYLE[st])}>
                <span className={cn('flex items-center gap-1.5 text-sm font-semibold', st === 'pending' ? 'text-fg-secondary' : 'text-fg')}>
                  {st === 'done' && <Check size={13} aria-hidden className="shrink-0 text-success" />}
                  {st === 'running' && <Spinner className="size-3 shrink-0" />}
                  {st === 'failed' && <X size={13} aria-hidden className="shrink-0 text-danger" />}
                  <span className="truncate">{d.step[s.kind]}</span>
                  <span className="sr-only"> · {d.stepState[st]}</span>
                </span>
                <span className="truncate font-mono text-xs text-fg-muted" title={s.cmd}>{s.cmd}</span>
              </li>
            )
          })}
        </ol>
      )}

      <LogBox text={log} label={d.logOf.replace('{name}', target.name)} placeholder={d.waiting} className={live ? '[&_pre]:max-h-56' : '[&_pre]:max-h-36'} />
    </Card>
  )
}
