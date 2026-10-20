import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { AlertTriangle, Check, Download, ExternalLink, FolderDown, KeyRound, Play, RefreshCw, RotateCcw, ScrollText, Square } from 'lucide-react'
import type { N8nDomainCheck, N8nExecution, N8nExposure, N8nInstance, N8nLocale, N8nPrecheck, N8nStatus, N8nWorkflow, Project, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Switch from '@renderer/components/ui/Switch'
import Spinner from '@renderer/components/ui/Spinner'
import { Input, Select } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const KEY = 'devforge:n8n-server'

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
  const [connections, setConnections] = useState<SSHConnection[] | null>(null)
  const [serverId, setServerId] = useState(() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })
  const [instances, setInstances] = useState<N8nInstance[]>([])

  useEffect(() => {
    window.devforge.getSshConnections().then(c => {
      setConnections(c)
      setServerId(prev => (c.some(x => x.id === prev) ? prev : c[0]?.id ?? ''))
    }).catch(() => setConnections([]))
    window.devforge.n8n.instances().then(setInstances).catch(() => {})
  }, [])
  useEffect(() => { try { if (serverId) localStorage.setItem(KEY, serverId) } catch { /* not kept */ } }, [serverId])

  const conn = connections?.find(c => c.id === serverId)
  const instance = instances.find(i => i.connectionId === serverId)
  const refreshInstances = useCallback(() => window.devforge.n8n.instances().then(setInstances).catch(() => {}), [])

  return (
    <Page>
      <PageHeader title="n8n" subtitle={n.subtitle}
        actions={connections && connections.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            {n.server}
            <Select value={serverId} onChange={e => setServerId(e.target.value)} className="w-64">
              {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.host}</option>)}
            </Select>
          </label>
        )} />
      {!connections ? <Spinner /> : !conn ? <EmptyState title={n.noServers} /> : instance
        ? <Installed key={conn.id} conn={conn} instance={instance} onChange={refreshInstances} />
        : <Install key={conn.id} conn={conn} onDone={refreshInstances} />}
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

function LogBox({ text, title }: { text: string; title: string }) {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }) }, [text])
  return (
    <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-console">
      <div className="border-b border-line-subtle px-4 py-2.5 text-[12.5px] font-semibold text-fg">{title}</div>
      <pre ref={ref} className="max-h-80 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">{text || '…'}</pre>
    </div>
  )
}

/** French editor on / off: the community image github.com/victhille/n8n-fr */
function FrenchRow({ locale, onChange, busy }: { locale: N8nLocale; onChange: (l: N8nLocale) => void; busy?: boolean }) {
  const { t } = useI18n()
  const n = t.n8n
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium text-fg">{n.frenchUi}</div>
        <p className="mt-0.5 text-xs text-fg-secondary">{n.frenchUiHint}</p>
      </div>
      {busy ? <Spinner /> : <Switch checked={locale === 'fr'} label={n.frenchUi} onChange={on => onChange(on ? 'fr' : 'en')} />}
    </div>
  )
}

function Install({ conn, onDone }: { conn: SSHConnection; onDone: () => void }) {
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
    <div className="flex max-w-3xl flex-col gap-4">
      <Card className="df-rise flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-forgy-soft"><N8nMark /></div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-fg">{n.installTitle.replace('{name}', conn.name)}</h2>
            <p className="mt-0.5 text-[12.5px] text-fg-secondary">{n.installHint}</p>
          </div>
        </div>

        {checkError ? <p className="text-sm text-danger">{checkError}</p> : !check ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {n.checking}</p>
        ) : (
          <>
            {[!check.docker && n.dockerMissing, check.docker && !check.compose && n.composeMissing,
              exposure === 'caddy' && check.busyPorts.length > 0 && n.portsBusy.replace('{ports}', check.busyPorts.join(', ')),
              check.existing && n.existing].filter(Boolean).map(msg => (
              <p key={msg as string} className="flex items-start gap-2 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[13px] text-fg"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" /> {msg}</p>
            ))}
            {check.docker && <p className="font-mono text-xs text-fg-muted">{check.docker}</p>}
          </>
        )}

        <div>
          <div className="mb-2 text-[13.5px] font-medium text-fg">{n.exposure}</div>
          <div role="radiogroup" aria-label={n.exposure} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {options.map(o => (
              <button key={o.id} type="button" role="radio" aria-checked={exposure === o.id} onClick={() => setExposure(o.id)}
                className={cn('flex flex-col gap-1 rounded-xl border-2 bg-canvas p-3 text-left transition-colors', exposure === o.id ? 'border-accent' : 'border-line hover:border-fg-disabled')}>
                <span className="text-[13px] font-medium text-fg">{o.title}</span>
                <span className="text-xs text-fg-secondary">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {exposure === 'caddy' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{n.domain}
              <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder={n.domainPlaceholder} className="font-mono" />
              {sslip && !domain && <button type="button" onClick={() => setDomain(sslip)} className="self-start text-xs text-accent hover:underline">{n.useSslip.replace('{name}', sslip)}</button>}
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{n.email}
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="toi@exemple.fr" />
            </label>
          </div>
        )}

        {exposure === 'caddy' && dns && (() => {
          const c = dns.check
          const ip = c?.serverIps[0] ?? conn.host
          if (!c) return <p className="flex items-center gap-2 text-[13px] text-fg-muted"><Spinner /> {n.domainChecking}</p>
          if (c.ok) return <p className="flex items-center gap-2 text-[13px] text-success"><Check size={14} /> {n.domainOk.replace('{domain}', dns.domain).replace('{ip}', ip)}</p>
          const msg = c.domainIps.length
            ? n.domainElsewhere.replace('{domain}', dns.domain).replace('{ips}', c.domainIps.join(', ')).replace('{ip}', ip)
            : n.domainUnknown.replace('{domain}', dns.domain).replace('{name}', dns.domain.split('.')[0]).replace('{ip}', ip)
          return <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[13px] text-fg"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" /> {msg}</p>
        })()}

        <FrenchRow locale={locale} onChange={setLocale} />

        <div className="flex justify-end">
          <Button disabled={!check || blocked} loading={running} onClick={install}>{!running && <Download size={14} />} {n.install}</Button>
        </div>
      </Card>
      {(running || log) && <LogBox title={n.journal} text={log} />}
    </div>
  )
}

// ─── Installed ────────────────────────────────────────────────────────────────

function Installed({ conn, instance, onChange }: { conn: SSHConnection; instance: N8nInstance; onChange: () => void }) {
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
  const [onlyErrors, setOnlyErrors] = useState(true)
  const [apiError, setApiError] = useState('')
  const [projects, setProjects] = useState<Project[]>([])

  const loadStatus = useCallback(() => window.devforge.n8n.status(conn.id).then(setStatus).catch(err => toast.show({ tone: 'error', title: errorText(err) })), [conn.id, toast])
  useEffect(() => { loadStatus() }, [loadStatus])
  useEffect(() => { window.devforge.getProjects().then(setProjects).catch(() => {}) }, [])

  const say = (err: unknown) => { const e = errorText(err); return e === 'BAD_KEY' ? n.badKey : e }
  const loadApi = useCallback(async () => {
    if (!instance.hasKey) return
    setApiError('')
    try {
      const [w, e] = await Promise.all([window.devforge.n8n.workflows(conn.id), window.devforge.n8n.executions(conn.id, onlyErrors)])
      setWorkflows(w); setExecs(e)
    } catch (err) { setApiError(say(err)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id, instance.hasKey, onlyErrors])
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

  return (
    <div className="flex flex-col gap-4">
      <Card className="df-rise flex flex-wrap items-center gap-4 p-5">
        <div className="flex size-12 items-center justify-center rounded-[14px] bg-forgy-soft"><N8nMark size={26} /></div>
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-fg">n8n{status?.version ? ` ${status.version}` : ''}</h2>
            {!status ? <Spinner /> : (
              <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] font-medium', on ? 'bg-success-soft text-success' : 'bg-active text-fg-secondary')}>
                <span className={cn('size-1.5 rounded-full', on ? 'df-ping bg-success' : 'bg-fg-disabled')} />
                {on ? n.running : status.state ? n.stopped : n.notRunning}
              </span>
            )}
          </div>
          <div className="mt-1 font-mono text-xs text-fg-muted">
            {instance.exposure === 'caddy' ? `https://${instance.domain}` : tunnel ? n.tunnelOpen.replace('{url}', tunnel) : n.tunnelHint}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {on && <Button variant="secondary" loading={busy === 'tunnel'} onClick={openN8n}>{busy !== 'tunnel' && <ExternalLink size={14} />} {n.open}</Button>}
          {on ? (
            <>
              <Button variant="secondary" loading={busy === 'restart'} onClick={() => run('restart', () => window.devforge.n8n.control(conn.id, 'restart'))}>{busy !== 'restart' && <RotateCcw size={14} />} {n.restart}</Button>
              <Button variant="danger" loading={busy === 'stop'} onClick={() => run('stop', () => window.devforge.n8n.control(conn.id, 'stop'))}>{busy !== 'stop' && <Square size={13} />} {n.stop}</Button>
            </>
          ) : status && <Button loading={busy === 'start'} onClick={() => run('start', () => window.devforge.n8n.control(conn.id, 'start'))}>{busy !== 'start' && <Play size={14} />} {n.start}</Button>}
          <Button variant="secondary" loading={busy === 'update'}
            onClick={() => { if (window.confirm(n.updateConfirm)) { setLog(''); setShowLog('run'); run('update', () => window.devforge.n8n.update(conn.id), n.updateOk, n.updateFailed) } }}>
            {busy !== 'update' && <RefreshCw size={14} />} {n.update}
          </Button>
          <Button variant="ghost" onClick={async () => {
            if (showLog === 'logs') { setShowLog(null); return }
            setShowLog('logs'); setLog('')
            try { setLog(await window.devforge.n8n.logs(conn.id, 200)) } catch (err) { setLog(errorText(err)) }
          }}><ScrollText size={14} /> {n.logs}</Button>
        </div>
        {status && status.containers.length > 0 && (
          <div className="flex w-full flex-wrap gap-2">
            {status.containers.map(c => (
              <span key={c.name} className="flex items-center gap-1.5 rounded-lg border border-line-subtle bg-canvas px-2.5 py-1 font-mono text-[11.5px] text-fg-secondary">
                <span className={cn('size-1.5 rounded-full', c.state === 'running' ? 'bg-success' : 'bg-fg-disabled')} />{c.name} · {c.status}
              </span>
            ))}
          </div>
        )}
      </Card>

      {showLog && <LogBox title={showLog === 'logs' ? n.logs : n.journal} text={log} />}

      <Card className="df-rise max-w-2xl p-5" style={{ '--i': 1 } as CSSProperties}>
        <FrenchRow locale={instance.locale} busy={busy === 'locale'} onChange={async locale => {
          if (!window.confirm(locale === 'fr' ? n.frenchUiConfirmOn : n.frenchUiConfirmOff)) return
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

      {!instance.hasKey ? (
        <Card className="df-rise flex max-w-2xl flex-col gap-3 p-5" style={{ '--i': 1 } as CSSProperties}>
          <h3 className="text-md font-semibold text-fg">{n.apiKey}</h3>
          <p className="text-[12.5px] text-fg-secondary">{n.apiKeyHint}</p>
          <div className="flex gap-2">
            <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={n.apiKeyPlaceholder} aria-label={n.apiKey} className="font-mono" autoComplete="off" />
            <Button disabled={!key.trim()} onClick={async () => { await window.devforge.n8n.saveKey(conn.id, key); setKey(''); onChange() }}><KeyRound size={14} /> {n.saveKey}</Button>
          </div>
        </Card>
      ) : apiError ? (
        <Card className="flex flex-wrap items-center gap-3 p-5 text-sm text-danger">
          <span className="flex-1">{apiError}</span>
          <Button size="sm" variant="ghost" onClick={async () => { await window.devforge.n8n.saveKey(conn.id, null); onChange() }}>{n.removeKey}</Button>
        </Card>
      ) : on && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[3fr_2fr]">
          <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
            <h3 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{n.workflows}{workflows && <span className="ml-2 font-mono text-xs text-fg-muted">{workflows.length}</span>}</h3>
            {!workflows ? <div className="p-[18px]"><Spinner /></div> : workflows.length === 0 ? <p className="px-[18px] pb-4 text-sm text-fg-muted">{n.noWorkflows}</p> : workflows.map(w => (
              <div key={w.id} className="group flex items-center gap-3 border-t border-line-subtle px-[18px] py-2.5">
                <Switch checked={w.active} label={w.name} onChange={async active => {
                  try { const u = await window.devforge.n8n.setActive(conn.id, w.id, active); setWorkflows(ws => ws?.map(x => (x.id === u.id ? u : x)) ?? null) }
                  catch (err) { toast.show({ tone: 'error', title: say(err) }) }
                }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{w.name}</div>
                  <div className="truncate text-xs text-fg-muted">
                    {n.updatedWhen.replace('{when}', formatRelative(w.updatedAt, lang))}{w.tags.length > 0 && ` · ${w.tags.join(', ')}`}
                  </div>
                </div>
                {projects.length > 0 && (
                  <label className="flex items-center opacity-60 group-hover:opacity-100">
                    <span className="sr-only">{n.exportTo}</span>
                    <FolderDown size={14} className="mr-1 text-fg-muted" aria-hidden />
                    <select value="" title={n.exportTo} onChange={async e => {
                      const pid = e.target.value
                      if (!pid) return
                      try { const file = await window.devforge.n8n.exportWorkflow(conn.id, w.id, pid); toast.show({ tone: 'success', title: n.exported.replace('{file}', file) }) }
                      catch (err) { toast.show({ tone: 'error', title: say(err) }) }
                    }} className="h-7 max-w-36 rounded-md border border-line bg-canvas px-1.5 text-xs text-fg-secondary outline-none">
                      <option value="">{n.exportTo}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                )}
              </div>
            ))}
          </Card>
          <Card className="df-rise self-start overflow-hidden" style={{ '--i': 2 } as CSSProperties}>
            <div className="flex items-center gap-3 px-[18px] pt-4 pb-2">
              <h3 className="flex-1 text-md font-semibold text-fg">{n.executions}</h3>
              <label className="flex items-center gap-2 text-xs text-fg-secondary">{n.onlyErrors}<Switch checked={onlyErrors} onChange={setOnlyErrors} label={n.onlyErrors} /></label>
            </div>
            {!execs ? <div className="p-[18px]"><Spinner /></div> : execs.length === 0 ? <p className="px-[18px] pb-4 text-sm text-fg-muted">{n.noExecutions}</p> : execs.map(e => (
              <div key={e.id} className="flex items-center gap-3 border-t border-line-subtle px-[18px] py-2.5">
                <span className={cn('w-20 shrink-0 rounded-full px-2 py-0.5 text-center font-mono text-[11px]',
                  e.status === 'success' ? 'bg-success-soft text-success' : ['error', 'crashed'].includes(e.status) ? 'bg-danger-soft text-danger' : 'bg-active text-fg-secondary')}>
                  {n.status[e.status as keyof typeof n.status] ?? e.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">{e.workflowName}</span>
                <span className="shrink-0 font-mono text-[11.5px] text-fg-muted">{formatRelative(e.startedAt, lang)}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <button onClick={async () => { if (window.confirm(n.forgetConfirm.replace('{name}', conn.name))) { await window.devforge.n8n.forget(conn.id); onChange() } }}
        className="self-start text-xs text-fg-muted hover:text-danger">{n.forget}</button>
    </div>
  )
}
