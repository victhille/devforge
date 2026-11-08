import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Check, Download, ExternalLink, FolderDown, KeyRound, LogOut, Play, RefreshCw, RotateCcw, ScrollText, Square, Workflow } from 'lucide-react'
import type { N8nDomainCheck, N8nExecution, N8nExposure, N8nInstance, N8nLocale, N8nPrecheck, N8nStatus, N8nWorkflow, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import Stat, { StatRow } from '@renderer/components/ui/Stat'
import Switch from '@renderer/components/ui/Switch'
import Spinner from '@renderer/components/ui/Spinner'
import { Input } from '@renderer/components/ui/Input'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { ServerSelect, useServerPicker } from '@renderer/features/vps/ServerPicker'
import { errorText } from '@renderer/lib/errors'
import { NO_PROJECTS, useProjectList } from '@renderer/hooks/useLiveData'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import Notice from '@renderer/components/ui/Notice'
import LogBox from '@renderer/components/ui/LogBox'

const KEY = 'devforge:n8n-server'
const DAY = 86_400_000

/** The n8n logo's three linked nodes, drawn in the app's ink */
function N8nMark({ size = 22 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" className="stroke-forgy" strokeWidth="2" strokeLinecap="round">
      <circle cx="4.5" cy="12" r="2.5" /><circle cx="12" cy="6" r="2.5" /><circle cx="19.5" cy="12" r="2.5" /><circle cx="12" cy="18" r="2.5" />
      <path d="M7 12h2.5l2.5-3.5 M7 12h2.5l2.5 3.5 M14.5 6H17l2.5 3.5" />
    </svg>
  )
}

export default function N8nPage() {
  const { t } = useI18n()
  const n = t.n8n
  const { connections, conn, serverId, setServerId } = useServerPicker(KEY)
  const [instances, setInstances] = useState<N8nInstance[]>([])
  const refreshInstances = useCallback(() => window.devforge.n8n.instances().then(setInstances).catch(() => {}), [])
  useEffect(() => { refreshInstances() }, [refreshInstances])
  const instance = instances.find(i => i.connectionId === serverId)
  const picker = <ServerSelect connections={connections} value={serverId} onChange={setServerId} />

  return (
    <Page className="df-mockup">
      {!connections || !conn ? (
        <>
          <PageHeader crumb={t.nav.groupOnline} title="n8n" subtitle={n.subtitle} />
          {!connections ? <Spinner /> : <NeedsSetup service="server" />}
        </>
      ) : instance
        ? <Installed key={conn.id} conn={conn} instance={instance} picker={picker} onChange={refreshInstances} />
        : <Install key={conn.id} conn={conn} picker={picker} onDone={refreshInstances} />}
    </Page>
  )
}

// ─── Install ──────────────────────────────────────────────────────────────────

/** Live output of an install or update on the server */
function useServerLog(connectionId: string) {
  const [log, setLog] = useState('')
  useEffect(() => window.devforge.n8n.onLog(e => { if (e.connectionId === connectionId) setLog(l => (l + e.text).slice(-40_000)) }), [connectionId])
  return [log, setLog] as const
}

/** French editor on / off: the community image github.com/victhille/n8n-fr */
function FrenchRow({ locale, onChange, busy }: { locale: N8nLocale; onChange: (l: N8nLocale) => void; busy?: boolean }) {
  const { t } = useI18n()
  const n = t.n8n
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-base font-medium text-fg">{n.frenchUi}</div>
        <p className="mt-0.5 text-sm text-fg-secondary">{n.frenchUiHint}</p>
      </div>
      {busy ? <Spinner /> : <Switch checked={locale === 'fr'} label={n.frenchUi} onChange={on => onChange(on ? 'fr' : 'en')} />}
    </div>
  )
}

function Install({ conn, picker, onDone }: { conn: SSHConnection; picker: ReactNode; onDone: () => void }) {
  const { t, lang } = useI18n()
  const n = t.n8n
  const toast = useToast()
  const [check, setCheck] = useState<N8nPrecheck | null>(null)
  const [checkError, setCheckError] = useState('')
  const [exposure, setExposure] = useState<N8nExposure>('caddy')
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [locale, setLocale] = useState<N8nLocale>(lang === 'fr' ? 'fr' : 'en')
  const [running, setRunning] = useState(false)
  const [log, setLog] = useServerLog(conn.id)
  const [dns, setDns] = useState<{ domain: string; check: N8nDomainCheck | null } | null>(null)

  // The sub-domain must point to the server before Caddy can get a certificate
  useEffect(() => {
    const d = domain.trim().toLowerCase()
    if (exposure !== 'caddy' || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) { setDns(null); return }
    setDns({ domain: d, check: null })
    const id = setTimeout(() => {
      window.devforge.n8n.checkDomain(conn.id, d).then(check => setDns(cur => (cur?.domain === d ? { domain: d, check } : cur))).catch(() => setDns(null))
    }, 500)
    return () => clearTimeout(id)
  }, [domain, exposure, conn.id])
  const sslip = /^\d+\.\d+\.\d+\.\d+$/.test(conn.host) ? `n8n.${conn.host.replace(/\./g, '-')}.sslip.io` : null

  useEffect(() => {
    window.devforge.n8n.precheck(conn.id).then(c => { setCheck(c); if (c.busyPorts.length) setExposure('local') }).catch(err => setCheckError(errorText(err)))
  }, [conn.id])

  const blocked = !check?.docker || !check.compose || (exposure === 'caddy' && (check.busyPorts.length > 0 || !domain.trim() || !email.trim() || !dns?.check?.ok))

  async function install() {
    setRunning(true); setLog('')
    try {
      const r = await window.devforge.n8n.install(conn.id, { domain, exposure, email, locale })
      toast.show({ tone: r.ok ? 'success' : 'error', title: r.ok ? n.installOk : n.installFailed })
      if (r.ok) onDone()
    } catch (err) {
      const e = errorText(err)
      toast.show({ tone: 'error', title: e.startsWith('FR_NOT_READY:') ? n.frenchNotReady.replace('{version}', e.slice(13)) : e === 'DOMAIN_UNKNOWN' || e.startsWith('DOMAIN_ELSEWHERE') ? n.installFailed : e })
    }
    finally { setRunning(false) }
  }

  const options: { id: N8nExposure; title: string; hint: string }[] = [
    { id: 'caddy', title: n.exposureCaddy, hint: n.exposureCaddyHint },
    { id: 'local', title: n.exposureLocal, hint: n.exposureLocalHint }
  ]

  return (
    <>
      <PageHeader crumb={`${t.nav.groupOnline} · ${conn.name}`} title="n8n" subtitle={n.subtitle} actions={picker} />
      <div className="flex max-w-3xl flex-col gap-4">
        <Card className="df-rise flex flex-col gap-4 p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-forgy-soft"><N8nMark /></div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{n.installTitle.replace('{name}', conn.name)}</h2>
              <p className="mt-0.5 text-sm text-fg-secondary">{n.installHint}</p>
            </div>
          </div>

          {checkError ? <p className="text-sm text-danger">{checkError}</p> : !check ? (
            <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {n.checking}</p>
          ) : (
            <>
              {[!check.docker && n.dockerMissing, check.docker && !check.compose && n.composeMissing,
                exposure === 'caddy' && check.busyPorts.length > 0 && n.portsBusy.replace('{ports}', check.busyPorts.join(', ')),
                check.existing && n.existing].filter(Boolean).map(msg => (
                <Notice key={msg as string} tone="warning">{msg}</Notice>
              ))}
              {check.docker && <p className="font-mono text-xs text-fg-muted">{check.docker}</p>}
            </>
          )}

          <div>
            <div className="mb-2 text-base font-medium text-fg">{n.exposure}</div>
            <div role="radiogroup" aria-label={n.exposure} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {options.map(o => (
                <button key={o.id} type="button" role="radio" aria-checked={exposure === o.id} onClick={() => setExposure(o.id)}
                  className={cn('flex flex-col gap-1 rounded-xl border-2 bg-canvas p-3 text-left transition-colors', exposure === o.id ? 'border-accent' : 'border-line hover:border-fg-disabled')}>
                  <span className="text-base font-medium text-fg">{o.title}</span>
                  <span className="text-sm text-fg-secondary">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {exposure === 'caddy' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{n.domain}
                <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder={n.domainPlaceholder} className="font-mono" />
                {sslip && !domain && <button type="button" onClick={() => setDomain(sslip)} className="self-start text-sm text-accent hover:underline">{n.useSslip.replace('{name}', sslip)}</button>}
              </label>
              <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{n.email}
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={n.emailPlaceholder} />
              </label>
            </div>
          )}

          {exposure === 'caddy' && dns && (() => {
            const c = dns.check
            const ip = c?.serverIps[0] ?? conn.host
            if (!c) return <p className="flex items-center gap-2 text-base text-fg-muted"><Spinner /> {n.domainChecking}</p>
            if (c.ok) return <p className="flex items-center gap-2 text-base text-success"><Check size={14} aria-hidden /> {n.domainOk.replace('{domain}', dns.domain).replace('{ip}', ip)}</p>
            const msg = c.domainIps.length
              ? n.domainElsewhere.replace('{domain}', dns.domain).replace('{ips}', c.domainIps.join(', ')).replace('{ip}', ip)
              : n.domainUnknown.replace('{domain}', dns.domain).replace('{name}', dns.domain.split('.')[0]).replace('{ip}', ip)
            return <Notice tone="warning" live>{msg}</Notice>
          })()}

          <FrenchRow locale={locale} onChange={setLocale} />

          <div className="flex justify-end">
            <Button disabled={!check || blocked} loading={running} onClick={install}>{!running && <Download size={14} aria-hidden />} {n.install}</Button>
          </div>
        </Card>
        {(running || log) && <LogBox title={n.journal} text={log} />}
      </div>
    </>
  )
}

/** A workflow exported to a project's folder: picked in its row, shown on hover or focus */
function ExportPicker({ workflow, conn, say }: { workflow: N8nWorkflow; conn: SSHConnection; say: (err: unknown) => string }) {
  const { t } = useI18n()
  const n = t.n8n
  const toast = useToast()
  const projects = useProjectList().data ?? NO_PROJECTS
  return (
    <label className="ml-auto inline-flex shrink-0 items-center font-normal opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <span className="sr-only">{n.exportOf.replace('{name}', workflow.name)}</span>
      <FolderDown size={14} className="mr-1 text-fg-muted" aria-hidden />
      <select value="" title={n.exportTo} onChange={async e => {
        const pid = e.target.value
        if (!pid) return
        try { const file = await window.devforge.n8n.exportWorkflow(conn.id, workflow.id, pid); toast.show({ tone: 'success', title: n.exported.replace('{file}', file) }) }
        catch (err) { toast.show({ tone: 'error', title: say(err) }) }
      }} className="h-7 max-w-36 rounded-md border border-line bg-canvas px-1.5 text-xs text-fg-secondary outline-none">
        <option value="">{n.exportTo}</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  )
}

// ─── Installed ────────────────────────────────────────────────────────────────

const failedRun = (e: N8nExecution) => e.status === 'error' || e.status === 'crashed'
/** The server's clock may run ahead of this PC's: a run is never « in 3 h » */
const notAfterNow = (iso: string) => (Date.parse(iso) > Date.now() ? new Date().toISOString() : iso)
/** « 2 nov. », the year only when it is not this one */
const shortDate = (iso: string, lang: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) })
}

/**
 * As in the mock-up: n8n's state and version in the title, Restart and Open,
 * four counts (active workflows, runs and failures of the day, the public
 * address), then the workflows with their trigger, last run and switch.
 */
function Installed({ conn, instance, picker, onChange }: { conn: SSHConnection; instance: N8nInstance; picker: ReactNode; onChange: () => void }) {
  const { t, lang } = useI18n()
  const n = t.n8n
  const toast = useToast()
  const [status, setStatus] = useState<N8nStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [log, setLog] = useServerLog(conn.id)
  const [showLog, setShowLog] = useState<'logs' | 'run' | null>(null)
  const [key, setKey] = useState('')
  const [workflows, setWorkflows] = useState<N8nWorkflow[] | null>(null)
  const [execs, setExecs] = useState<N8nExecution[] | null>(null)
  const [apiError, setApiError] = useState('')
  const projects = useProjectList().data ?? NO_PROJECTS

  const loadStatus = useCallback(() => window.devforge.n8n.status(conn.id).then(setStatus).catch(err => toast.show({ tone: 'error', title: errorText(err) })), [conn.id, toast])
  useEffect(() => { loadStatus() }, [loadStatus])

  const say = useCallback((err: unknown) => { const e = errorText(err); return e === 'BAD_KEY' ? n.badKey : e }, [n.badKey])
  const loadApi = useCallback(async () => {
    if (!instance.hasKey) return
    setApiError('')
    try {
      const [w, e] = await Promise.all([window.devforge.n8n.workflows(conn.id), window.devforge.n8n.executions(conn.id, false)])
      setWorkflows(w); setExecs(e)
    } catch (err) { setApiError(say(err)) }
  }, [conn.id, instance.hasKey, say])
  useEffect(() => { if (status?.state === 'running') loadApi() }, [status?.state, loadApi])

  async function run(id: string, fn: () => Promise<{ ok: boolean; output?: string }>, okText?: string, failText?: string) {
    setBusy(id)
    try {
      const r = await fn()
      if (!r.ok) toast.show({ tone: 'error', title: failText ?? id, description: r.output?.slice(-400) })
      else if (okText) toast.show({ tone: 'success', title: okText })
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
    finally { setBusy(null); loadStatus() }
  }

  const on = status?.state === 'running'
  const [tunnel, setTunnel] = useState<string | null>(null)
  async function openN8n() {
    if (status?.url) { window.devforge.openExternal(status.url); return }
    setBusy('tunnel')
    try { const url = await window.devforge.n8n.openTunnel(conn.id); setTunnel(url); window.devforge.openExternal(url) }
    catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
    finally { setBusy(null) }
  }
  async function showLogs() {
    if (showLog === 'logs') { setShowLog(null); return }
    setShowLog('logs'); setLog('')
    try { setLog(await window.devforge.n8n.logs(conn.id, 200)) } catch (err) { setLog(errorText(err)) }
  }
  async function update() {
    if (!(await confirmDialog(n.updateConfirm))) return
    setLog(''); setShowLog('run')
    run('update', () => window.devforge.n8n.update(conn.id), n.updateOk, n.updateFailed)
  }
  async function forget() {
    if ((await confirmDialog(n.forgetConfirm.replace('{name}', conn.name), { danger: true }))) { await window.devforge.n8n.forget(conn.id); onChange() }
  }

  // The day's runs: the API gives the last 50, a full page of the day says « 50+ »
  const day = useMemo(() => {
    const list = execs ?? []
    const recent = list.filter(e => Date.now() - Date.parse(e.startedAt) < DAY)
    const capped = list.length >= 50 && recent.length === list.length
    return { recent, capped, failures: recent.filter(failedRun) }
  }, [execs])
  const plus = (v: number) => `${v}${day.capped ? '+' : ''}`

  const title = (
    <span className="flex min-w-0 items-center gap-3">
      n8n
      {!status ? <Spinner /> : (
        <Badge dot color={on ? 'success' : 'default'}>{on ? (status.version ? n.onlineVersion.replace('{v}', status.version) : n.running) : status.state ? n.stopped : n.notRunning}</Badge>
      )}
    </span>
  )
  const address = instance.exposure === 'caddy' && instance.domain ? instance.domain : tunnel ? tunnel.replace(/^https?:\/\//, '') : n.viaTunnel

  return (
    <>
      <PageHeader crumb={`${t.nav.groupOnline} · ${conn.name}`} title={title} subtitle={n.subtitle}
        actions={<>
          {picker}
          {on && <Button variant="secondary" loading={busy === 'restart'} onClick={() => run('restart', () => window.devforge.n8n.control(conn.id, 'restart'))}>{busy !== 'restart' && <RotateCcw size={14} aria-hidden />} {n.restartN8n}</Button>}
          {on ? <Button loading={busy === 'tunnel'} onClick={openN8n}>{busy !== 'tunnel' && <ExternalLink size={14} aria-hidden />} {n.open}</Button>
            : status && <Button loading={busy === 'start'} onClick={() => run('start', () => window.devforge.n8n.control(conn.id, 'start'))}>{busy !== 'start' && <Play size={14} aria-hidden />} {n.start}</Button>}
          <MoreMenu label={n.more} items={[
            { label: n.update, icon: RefreshCw, onSelect: update },
            { label: showLog === 'logs' ? n.hideLogs : n.logs, icon: ScrollText, onSelect: showLogs },
            ...(on ? [{ label: n.stop, icon: Square, onSelect: () => run('stop', () => window.devforge.n8n.control(conn.id, 'stop')) }] : []),
            { label: n.forget, icon: LogOut, danger: true, onSelect: forget }
          ]} />
        </>} />

      {(busy === 'update' || busy === 'stop') && <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {busy === 'update' ? n.updating : n.stopping}</p>}
      {showLog && <LogBox title={showLog === 'logs' ? n.logs : n.journal} text={log} />}

      {instance.hasKey && workflows && !apiError && (
        <StatRow>
          <Stat label={n.statActive} value={workflows.filter(w => w.active).length} unit={n.statOf.replace('{n}', String(workflows.length))} />
          <Stat label={n.statRuns} value={plus(day.recent.length)} />
          <Stat label={n.statFailures} value={plus(day.failures.length)} tone={day.failures.length ? 'danger' : undefined} />
          <Stat label={instance.exposure === 'caddy' && instance.domain ? n.statWebhook : n.statAccess} value={<span className="block truncate text-md" title={address}>{address}</span>} />
        </StatRow>
      )}

      {!instance.hasKey ? (
        <Card className="df-rise flex max-w-2xl flex-col gap-3 p-5">
          <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{n.apiKey}</h2>
          <p className="text-sm text-fg-secondary">{n.apiKeyHint}</p>
          <div className="flex gap-2">
            <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={n.apiKeyPlaceholder} aria-label={n.apiKey} className="font-mono" autoComplete="off" />
            <Button disabled={!key.trim()} onClick={async () => { await window.devforge.n8n.saveKey(conn.id, key); setKey(''); onChange() }}><KeyRound size={14} aria-hidden /> {n.saveKey}</Button>
          </div>
        </Card>
      ) : apiError ? (
        <Card className="flex flex-wrap items-center gap-3 p-5 text-sm text-danger">
          <span className="flex-1">{apiError}</span>
          <Button size="sm" variant="ghost" onClick={async () => { await window.devforge.n8n.saveKey(conn.id, null); onChange() }}>{n.removeKey}</Button>
        </Card>
      ) : !on ? null : !workflows ? <Spinner /> : (
        <Card>
          {workflows.length === 0 ? <p className="px-4.5 py-4 text-sm text-fg-muted">{n.noWorkflows}</p> : (
            <Table>
              <thead>
                <tr>
                  <Th className="pl-4.5">{n.colWorkflow}</Th>
                  <Th>{n.colTrigger}</Th>
                  <Th>{n.colLast}</Th>
                  <Th align="right">{n.col24h}</Th>
                  <Th align="right" className="pr-4.5">{n.colActive}</Th>
                </tr>
              </thead>
              <tbody>
                {workflows.map(w => {
                  const mine = (execs ?? []).filter(e => e.workflowId === w.id)
                  const last = mine[0]
                  const today = mine.filter(e => Date.now() - Date.parse(e.startedAt) < DAY).length
                  return (
                    <tr key={w.id} className="group">
                      <Td className="min-w-[220px] pl-4.5">
                        <span className={cn('flex items-center gap-2.5', w.active ? 'font-semibold text-fg' : 'text-fg-secondary')}>
                          <Workflow size={14} aria-hidden className={cn('shrink-0', w.active ? 'text-accent' : 'text-fg-muted')} />
                          <span className="truncate">{w.name}</span>
                          {projects.length > 0 && <ExportPicker workflow={w} conn={conn} say={say} />}
                        </span>
                      </Td>
                      <Td className={cn('whitespace-nowrap', w.active ? 'text-fg' : 'text-fg-muted')}>
                        {!w.trigger ? '—' : w.trigger.kind === 'other' ? w.trigger.name : n.trigger[w.trigger.kind]}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {!w.active && !last ? <span className="text-fg-muted">{n.pausedSince.replace('{date}', shortDate(w.updatedAt, lang))}</span>
                          : last ? (
                            <span className="inline-flex items-center gap-2">
                              <Badge color={last.status === 'success' ? 'success' : failedRun(last) ? 'danger' : 'default'}>{n.status[last.status as keyof typeof n.status] ?? last.status}</Badge>
                              <span className="text-fg-secondary">{formatRelative(notAfterNow(last.startedAt), lang)}</span>
                            </span>
                          ) : <span className="text-fg-muted">{n.noRun}</span>}
                      </Td>
                      <Td align="right" className={cn('font-mono', today ? 'text-fg' : 'text-fg-muted')}>{today}</Td>
                      <Td align="right" className="pr-4.5">
                        <span className="inline-flex">
                          <Switch checked={w.active} label={n.activeOf.replace('{name}', w.name)} onChange={async active => {
                            try { const u = await window.devforge.n8n.setActive(conn.id, w.id, active); setWorkflows(ws => ws?.map(x => (x.id === u.id ? { ...u, trigger: u.trigger ?? x.trigger } : x)) ?? null) }
                            catch (err) { toast.show({ tone: 'error', title: say(err) }) }
                          }} />
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {day.failures.length > 1 && (
        <Card>
          <h2 className="px-4.5 pt-4 pb-2 font-display text-md font-bold tracking-[-.01em] text-fg">{n.recentFailures}</h2>
          <ul aria-label={n.recentFailures}>
            {day.failures.slice(0, 8).map(e => (
              <li key={e.id} className="flex items-center gap-3 border-t border-line-subtle px-4.5 py-2.5">
                <Badge color="danger">{n.status[e.status as keyof typeof n.status] ?? e.status}</Badge>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{e.workflowName}</span>
                <span className="shrink-0 text-sm text-fg-muted">{formatRelative(notAfterNow(e.startedAt), lang)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <FrenchRow locale={instance.locale} busy={busy === 'locale'} onChange={async locale => {
          if (!(await confirmDialog(locale === 'fr' ? n.frenchUiConfirmOn : n.frenchUiConfirmOff))) return
          setBusy('locale'); setLog(''); setShowLog('run')
          try {
            await window.devforge.n8n.setLocale(conn.id, locale)
            toast.show({ tone: 'success', title: locale === 'fr' ? n.frenchUiOn : n.frenchUiOff })
            onChange()
          } catch (err) {
            const e = errorText(err)
            toast.show({ tone: 'error', title: e.startsWith('FR_NOT_READY:') ? n.frenchNotReady.replace('{version}', e.slice(13)) : e === 'LOCALE_FAILED' ? n.localeFailed : e })
          } finally { setBusy(null); loadStatus() }
        }} />
      </Card>
    </>
  )
}
