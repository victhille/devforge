import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ExternalLink, FlaskConical, Plus, RefreshCw, Send, Trash2, X } from 'lucide-react'
import type {
  SSHConnection, StatusConfig, StatusExposure, StatusIncident, StatusMonitor, StatusOverview, StatusPrecheck
} from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Input, Select, Textarea } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from '@renderer/features/vps/ServerPicker'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const DAYS = 90
const TEST_ID = 'devforge-test'
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
const slug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'service'
const randomTopic = () => `devforge-${Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, '0')).join('')}`

type T = ReturnType<typeof useI18n>['t']['statusPage']

export default function StatusPage() {
  const { t } = useI18n()
  const { connections, conn, serverId, setServerId } = useServerPicker()
  return (
    <Page>
      <PageHeader title={t.nav.statusPage} subtitle={t.statusPage.subtitle} actions={<ServerSelect connections={connections} value={serverId} onChange={setServerId} />} />
      {!connections ? <Spinner /> : !conn ? <EmptyState title={t.vpsOps.noServers} /> : <Status key={conn.id} conn={conn} />}
    </Page>
  )
}

function LogBox({ text, title, running }: { text: string; title: string; running: boolean }) {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }) }, [text])
  return (
    <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-console">
      <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5 text-[12.5px] font-semibold text-fg">{running && <Spinner />} {title}</div>
      <pre ref={ref} tabIndex={0} aria-label={title} className="max-h-72 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">{text || '…'}</pre>
    </div>
  )
}

function Status({ conn }: { conn: SSHConnection }) {
  const { t, lang } = useI18n()
  const s = t.statusPage
  const [data, setData] = useState<StatusOverview | null>(null)
  const [error, setError] = useState('')
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState<'install' | 'uninstall' | null>(null)
  const [blocked, setBlocked] = useState<number[]>([])

  const load = useCallback(() => {
    setError('')
    window.devforge.status.overview(conn.id).then(setData).catch(err => setError(errorText(err)))
  }, [conn.id])
  useEffect(load, [load])
  // Installed behind its own Caddy: is the firewall still closing it?
  useEffect(() => {
    if (!data?.installed || data.exposure === 'port') return
    window.devforge.status.precheck(conn.id).then(p => setBlocked(p.firewallBlocks)).catch(() => {})
  }, [conn.id, data?.installed, data?.exposure])
  useEffect(() => window.devforge.status.onLog(e => { if (e.connectionId === conn.id) setLog(l => l + e.text) }), [conn.id])

  async function uninstall() {
    if (!window.confirm(s.uninstallConfirm.replace('{name}', conn.name))) return
    setLog('')
    setBusy('uninstall')
    try { await window.devforge.status.uninstall(conn.id) } catch (err) { setError(errorText(err)) } finally { setBusy(null); load() }
  }

  if (error && !data) return <p role="alert" className="text-sm text-danger">{error}</p>
  if (!data) return <Spinner />
  if (!data.installed || busy === 'install') {
    return <Install conn={conn} log={log} setLog={setLog} busy={busy === 'install'} setBusy={b => setBusy(b ? 'install' : null)} onDone={load} />
  }
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <span className={cn('size-2.5 rounded-full', data.running ? 'bg-success' : 'bg-warning')} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-fg">{data.running ? s.online : s.stopped}</p>
          <p className="truncate font-mono text-xs text-fg-secondary">{data.url ?? '—'}{data.updatedAt ? ` · ${s.checked.replace('{when}', formatRelative(data.updatedAt, lang))}` : ''}</p>
        </div>
        <IconButton title={s.refresh} onClick={load}><RefreshCw size={14} /></IconButton>
        {data.url && <Button variant="secondary" onClick={() => window.devforge.openExternal(data.url!)}><ExternalLink size={14} /> {s.openPage}</Button>}
      </Card>
      <FirewallWarning conn={conn} blocked={blocked} onOpened={() => setBlocked([])} />
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {data.config && <Settings conn={conn} data={data} onSaved={load} />}
      <Incidents conn={conn} data={data} onSaved={load} />
      <Card className="flex flex-wrap items-center gap-3 border-danger/30 p-5">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{s.uninstall}</p>
          <p className="text-sm text-fg-secondary">{s.uninstallHint}</p>
        </div>
        <Button variant="danger" loading={busy === 'uninstall'} onClick={uninstall}>{s.uninstall}</Button>
      </Card>
      {busy === 'uninstall' && <LogBox text={log} title={s.uninstall} running />}
    </div>
  )
}

// ─── Installation ─────────────────────────────────────────────────────────────

function Install({ conn, log, setLog, busy, setBusy, onDone }: {
  conn: SSHConnection; log: string; setLog: (s: string) => void; busy: boolean; setBusy: (b: boolean) => void; onDone: () => void
}) {
  const { t } = useI18n()
  const s = t.statusPage
  const toast = useToast()
  const [pre, setPre] = useState<StatusPrecheck | null>(null)
  const [exposure, setExposure] = useState<StatusExposure>('caddy')
  const [own, setOwn] = useState(false)
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [dns, setDns] = useState<{ ok: boolean; text: string } | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState<boolean | null>(null)

  useEffect(() => {
    window.devforge.status.precheck(conn.id).then(p => { setPre(p); setExposure(p.suggested); setOwn(!p.sslip) }).catch(err => setError(errorText(err)))
  }, [conn.id])

  if (error && !pre) return <p role="alert" className="text-sm text-danger">{error}</p>
  if (!pre) return <div className="flex items-center gap-2 text-sm text-fg-secondary"><Spinner /> {s.prechecking}</div>

  const address = exposure === 'port' ? '' : own ? domain.trim().toLowerCase() : pre.sslip ?? ''
  const options: { id: StatusExposure; title: string; help: string; disabled: boolean }[] = [
    { id: 'caddy', title: s.exposure.caddy, help: s.exposureHelp.caddy, disabled: pre.busyPorts.length > 0 },
    { id: 'n8n', title: s.exposure.n8n, help: s.exposureHelp.n8n, disabled: !pre.n8nCaddy },
    { id: 'port', title: s.exposure.port, help: s.exposureHelp.port, disabled: false }
  ]

  async function checkDns() {
    setDns(null)
    try {
      const r = await window.devforge.status.checkDomain(conn.id, address)
      setDns({ ok: r.ok, text: r.ok ? s.dnsOk : r.domainIps.length ? s.dnsElsewhere.replace('{ips}', r.domainIps.join(', ')) : s.dnsUnknown })
    } catch (err) { setDns({ ok: false, text: errorText(err) }) }
  }

  async function install() {
    setError('')
    setLog('')
    setDone(null)
    setBusy(true)
    try {
      const r = await window.devforge.status.install(conn.id, { exposure, domain: address, email })
      setDone(r.ok)
      if (r.ok) { toast.show({ tone: 'success', title: s.installed }); onDone() }
    } catch (err) {
      const code = errorText(err)
      setError((s.errors as Record<string, string>)[code.split(':')[0]]?.replace('{ips}', code.split(':').slice(1).join(':')) ?? code)
    } finally { setBusy(false) }
  }

  const ready = !!pre.docker && pre.compose && (exposure === 'port' || (!!address && (exposure !== 'caddy' || !email || /\S+@\S+\.\S+/.test(email))))

  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-md font-semibold text-fg">{s.installTitle}</h2>
          <p className="mt-1 text-sm text-fg-secondary">{s.installHelp}</p>
        </div>
        {!pre.docker && <p role="alert" className="flex items-center gap-2 text-sm text-warning"><AlertTriangle size={14} /> {s.noDocker}</p>}
        <div role="radiogroup" aria-label={s.exposureLabel} className="grid gap-2 md:grid-cols-3">
          {options.map(o => (
            <button key={o.id} role="radio" aria-checked={exposure === o.id} disabled={o.disabled} onClick={() => setExposure(o.id)}
              className={cn('flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                exposure === o.id ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-canvas hover:border-line')}>
              <strong className="text-fg">{o.title}{pre.suggested === o.id && <span className="ml-2 text-xs font-normal text-accent">{s.suggested}</span>}</strong>
              <span className="text-sm text-fg-secondary">{o.help}</span>
            </button>
          ))}
        </div>
        {pre.busyPorts.length > 0 && <p className="text-xs text-fg-secondary">{s.portsBusy.replace('{ports}', pre.busyPorts.join(', '))}</p>}
        {exposure !== 'port' && <FirewallWarning conn={conn} blocked={pre.firewallBlocks} onOpened={() => setPre({ ...pre, firewallBlocks: [] })} />}

        {exposure !== 'port' && (
          <div className="flex flex-col gap-3">
            {pre.sslip && (
              <div role="radiogroup" aria-label={s.addressLabel} className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2 text-fg"><input type="radio" checked={!own} onChange={() => setOwn(false)} /> {s.addressSslip} <code className="font-mono text-xs text-fg-secondary">{pre.sslip}</code></label>
                <label className="flex items-center gap-2 text-fg"><input type="radio" checked={own} onChange={() => setOwn(true)} /> {s.addressOwn}</label>
              </div>
            )}
            {own && (
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.domain}
                  <Input value={domain} onChange={e => { setDomain(e.target.value); setDns(null) }} placeholder="status.mondomaine.fr" className="w-72 font-mono" spellCheck={false} />
                </label>
                <Button variant="secondary" disabled={!address} onClick={checkDns}>{s.checkDns}</Button>
              </div>
            )}
            {dns && <p className={cn('text-sm', dns.ok ? 'text-success' : 'text-warning')}>{dns.text}</p>}
            {exposure === 'caddy' && (
              <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.email}
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="toi@exemple.fr" className="w-72" />
                <span className="text-xs">{s.emailHint}</span>
              </label>
            )}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-xs text-fg-secondary">{s.installWhere}</span>
          <Button loading={busy} disabled={!ready} onClick={install}>{s.install}</Button>
        </div>
      </Card>
      {(busy || log) && <LogBox text={log} title={busy ? s.installing : done ? s.installed : s.installFailed} running={busy} />}
    </div>
  )
}

/** An active ufw keeps 80/443 closed: no certificate, no visitor. Opened only on a click. */
function FirewallWarning({ conn, blocked, onOpened }: { conn: SSHConnection; blocked: number[]; onOpened: () => void }) {
  const { t } = useI18n()
  const s = t.statusPage
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  if (!blocked.length) return null
  async function open() {
    if (!window.confirm(s.firewallConfirm.replace('{name}', conn.name))) return
    setBusy(true)
    try {
      const r = await window.devforge.status.openFirewall(conn.id)
      if (r.ok) { toast.show({ tone: 'success', title: s.firewallOpened }); onOpened() }
      else toast.show({ tone: 'error', title: s.firewallFailed, description: r.output.slice(-300) })
    } finally { setBusy(false) }
  }
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
      <AlertTriangle size={16} className="shrink-0 text-warning" />
      <p className="min-w-[220px] flex-1 text-sm text-fg">{s.firewallBlocked.replace('{ports}', blocked.join(', '))}</p>
      <Button size="sm" variant="secondary" loading={busy} onClick={open}>{s.firewallOpen}</Button>
    </div>
  )
}

// ─── Monitors, alerts, page ───────────────────────────────────────────────────

function uptime(history: StatusOverview['history'][string] | undefined): number | null {
  const days = Object.values(history ?? {})
  const total = days.reduce((a, d) => a + d.total, 0)
  return total ? days.reduce((a, d) => a + d.ok, 0) / total : null
}
const pct = (u: number | null) => u === null ? '—' : `${(Math.floor(u * 10000) / 100).toLocaleString()} %`

function Bars({ history, name, s }: { history: StatusOverview['history'][string] | undefined; name: string; s: T }) {
  return (
    <div role="img" aria-label={s.barsLabel.replace('{name}', name)} className="flex h-6 gap-px">
      {Array.from({ length: DAYS }, (_, i) => {
        const d = history?.[day(DAYS - 1 - i)]
        const u = d && d.total ? d.ok / d.total : null
        return <span key={i} title={`${day(DAYS - 1 - i)} · ${pct(u)}`} className={cn('flex-1 rounded-[1px]', u === null ? 'bg-elevated' : u >= 0.995 ? 'bg-success' : u >= 0.95 ? 'bg-warning' : 'bg-danger')} />
      })}
    </div>
  )
}

function Settings({ conn, data, onSaved }: { conn: SSHConnection; data: StatusOverview; onSaved: () => void }) {
  const { t } = useI18n()
  const s = t.statusPage
  const toast = useToast()
  const [config, setConfig] = useState<StatusConfig>(data.config!)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Omit<StatusMonitor, 'id'>>({ name: '', type: 'http', target: 'https://', public: true })

  useEffect(() => { if (!dirty) setConfig(data.config!) }, [data.config, dirty])
  const change = (patch: Partial<StatusConfig>) => { setConfig(c => ({ ...c, ...patch })); setDirty(true) }
  const setMonitor = (id: string, patch: Partial<StatusMonitor>) => change({ monitors: config.monitors.map(m => m.id === id ? { ...m, ...patch } : m) })

  async function save(next = config) {
    setError('')
    setSaving(true)
    try {
      await window.devforge.status.saveConfig(conn.id, next)
      setDirty(false)
      toast.show({ tone: 'success', title: s.saved })
      onSaved()
    } catch (err) {
      const code = errorText(err)
      setError((s.errors as Record<string, string>)[code] ?? code)
    } finally { setSaving(false) }
  }

  function add() {
    let id = slug(draft.name)
    for (let i = 2; config.monitors.some(m => m.id === id); i++) id = `${slug(draft.name)}-${i}`
    change({ monitors: [...config.monitors, { ...draft, id, name: draft.name.trim(), target: draft.target.trim() }] })
    setDraft({ name: '', type: 'http', target: 'https://', public: true })
  }

  const testing = config.monitors.some(m => m.id === TEST_ID)
  function toggleTest() {
    const next = testing
      ? { ...config, monitors: config.monitors.filter(m => m.id !== TEST_ID) }
      : { ...config, monitors: [...config.monitors, { id: TEST_ID, name: s.testName, type: 'tcp' as const, target: '127.0.0.1:9', public: true, test: true }] }
    setConfig(next)
    save(next)
  }

  async function sendTest() {
    try { await window.devforge.status.testAlert(config.alerts); toast.show({ tone: 'success', title: s.testSent }) } catch (err) {
      const code = errorText(err)
      toast.show({ tone: 'error', title: (s.errors as Record<string, string>)[code] ?? code })
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {dirty && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft p-3">
          <span className="flex-1 text-sm text-fg">{s.unsaved}</span>
          <Button variant="ghost" onClick={() => { setConfig(data.config!); setDirty(false) }}>{t.common.cancel}</Button>
          <Button loading={saving} onClick={() => save()}>{s.save}</Button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-md font-semibold text-fg">{s.monitorsTitle}</h2>
            <p className="mt-1 text-sm text-fg-secondary">{s.monitorsHelp}</p>
          </div>
          <Button variant="secondary" size="sm" disabled={dirty && !testing} onClick={toggleTest}><FlaskConical size={13} /> {testing ? s.testStop : s.testStart}</Button>
        </div>
        {testing && <p className="rounded-xl bg-warning/10 p-3 text-sm text-fg">{s.testRunning}</p>}
        {config.monitors.length === 0 ? <p className="text-sm text-fg-secondary">{s.noMonitors}</p> : (
          <ul aria-label={s.monitorsTitle} className="flex flex-col overflow-hidden rounded-xl border border-line-subtle">
            {config.monitors.map(m => {
              const st = data.monitors[m.id]
              return (
                <li key={m.id} aria-label={m.name} className="flex flex-col gap-2 border-t border-line-subtle px-4 py-3 first:border-t-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <span aria-hidden className={cn('size-2 rounded-full', st?.status === 'up' ? 'bg-success' : st?.status === 'down' ? 'bg-danger' : 'bg-fg-disabled')} />
                    <strong className="text-fg">{m.name}</strong>
                    <code className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">{m.type === 'tcp' ? `tcp ${m.target}` : m.target}</code>
                    <span className="text-xs text-fg-secondary">{st?.status === 'down' ? s.down.replace('{error}', st.lastError ?? '') : st?.lastMs != null ? `${st.lastMs} ms` : s.waiting}</span>
                    <span className="w-20 text-right font-mono text-xs text-fg-secondary">{pct(uptime(data.history[m.id]))}</span>
                    <Checkbox checked={m.public} onChange={v => setMonitor(m.id, { public: v })}>{s.public}</Checkbox>
                    <IconButton size="sm" title={s.remove.replace('{name}', m.name)} onClick={() => change({ monitors: config.monitors.filter(x => x.id !== m.id) })}><Trash2 size={13} /></IconButton>
                  </div>
                  <Bars history={data.history[m.id]} name={m.name} s={s} />
                </li>
              )
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-2 border-t border-line-subtle pt-4">
          <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.name}
            <Input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Boutique" className="w-44" />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.type}
            <Select value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as 'http' | 'tcp', target: e.target.value === 'tcp' ? '127.0.0.1:5432' : 'https://' }))} className="w-40">
              <option value="http">{s.typeHttp}</option>
              <option value="tcp">{s.typeTcp}</option>
            </Select>
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm text-fg-secondary">{s.target}
            <Input value={draft.target} onChange={e => setDraft(d => ({ ...d, target: e.target.value }))} className="min-w-[220px] font-mono" spellCheck={false} />
          </label>
          <Checkbox checked={draft.public} onChange={v => setDraft(d => ({ ...d, public: v }))} className="h-9">{s.public}</Checkbox>
          <Button variant="secondary" disabled={!draft.name.trim() || draft.target.trim().length < 8} onClick={add}><Plus size={14} /> {s.add}</Button>
        </div>
        {data.exposure === 'n8n' && <p className="text-xs text-fg-secondary">{s.n8nTargets}</p>}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="text-md font-semibold text-fg">{s.alertsTitle}</h2>
            <p className="mt-1 text-sm text-fg-secondary">{s.alertsHelp}</p>
          </div>
          <Checkbox checked={!!config.alerts.ntfy} onChange={v => change({ alerts: { ...config.alerts, ntfy: v ? { server: 'https://ntfy.sh', topic: randomTopic() } : null } })}>{s.ntfyOn}</Checkbox>
          {config.alerts.ntfy && (
            <div className="flex flex-col gap-2 pl-6">
              <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.ntfyTopic}
                <Input value={config.alerts.ntfy.topic} onChange={e => change({ alerts: { ...config.alerts, ntfy: { ...config.alerts.ntfy!, topic: e.target.value.trim() } } })} className="font-mono" spellCheck={false} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.ntfyServer}
                <Input value={config.alerts.ntfy.server} onChange={e => change({ alerts: { ...config.alerts, ntfy: { ...config.alerts.ntfy!, server: e.target.value.trim() } } })} className="font-mono" spellCheck={false} />
              </label>
              <p className="text-xs text-fg-secondary">{s.ntfyHint}</p>
            </div>
          )}
          <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.webhook}
            <Input value={config.alerts.webhook ?? ''} onChange={e => change({ alerts: { ...config.alerts, webhook: e.target.value.trim() || null } })} placeholder="https://n8n…/webhook/…" className="font-mono" spellCheck={false} />
            <span className="text-xs">{s.webhookHint}</span>
          </label>
          <div><Button size="sm" variant="secondary" disabled={!config.alerts.ntfy && !config.alerts.webhook} onClick={sendTest}><Send size={13} /> {s.sendTest}</Button></div>
        </Card>

        <Card className="flex flex-col gap-4 p-5">
          <h2 className="text-md font-semibold text-fg">{s.pageTitle}</h2>
          <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.title}
            <Input value={config.title} onChange={e => change({ title: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.interval}
              <Select value={String(config.intervalSec)} onChange={e => change({ intervalSec: Number(e.target.value) })}>
                {[30, 60, 120, 300].map(v => <option key={v} value={v}>{s.everySec.replace('{n}', String(v))}</option>)}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.failures}
              <Select value={String(config.failuresBeforeDown)} onChange={e => change({ failuresBeforeDown: Number(e.target.value) })}>
                {[1, 2, 3, 5].map(v => <option key={v} value={v}>{v}</option>)}
              </Select>
            </label>
          </div>
          <p className="text-xs text-fg-secondary">{s.pageHint}</p>
        </Card>
      </div>
    </div>
  )
}

// ─── Incidents ────────────────────────────────────────────────────────────────

function Incidents({ conn, data, onSaved }: { conn: SSHConnection; data: StatusOverview; onSaved: () => void }) {
  const { t } = useI18n()
  const s = t.statusPage
  const toast = useToast()
  const [writing, setWriting] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const manual = data.incidents.filter(i => !i.auto)

  async function saveManual(list: StatusIncident[]) {
    try { await window.devforge.status.saveIncidents(conn.id, list); onSaved() } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  async function publish() {
    await saveManual([{ id: `m${Date.now()}`, title: title.trim(), body: body.trim(), startedAt: new Date().toISOString(), resolvedAt: null, auto: false }, ...manual])
    setWriting(false)
    setTitle('')
    setBody('')
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-semibold text-fg">{s.incidentsTitle}</h2>
          <p className="mt-1 text-sm text-fg-secondary">{s.incidentsHelp}</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setWriting(true)}><Plus size={13} /> {s.writeIncident}</Button>
      </div>
      {data.incidents.length === 0 ? <p className="text-sm text-fg-secondary">{s.noIncidents}</p> : (
        <ul aria-label={s.incidentsTitle} className="flex flex-col gap-2">
          {data.incidents.slice(0, 15).map(i => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line-subtle bg-canvas px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-fg">{i.title} <span className="text-xs font-normal text-fg-secondary">· {i.auto ? s.auto : s.manual}</span></p>
                <p className="text-xs text-fg-secondary">{new Date(i.startedAt).toLocaleString()}{i.resolvedAt ? ` → ${new Date(i.resolvedAt).toLocaleString()}` : ''}{i.cause ? ` · ${i.cause}` : ''}</p>
                {i.body && <p className="mt-1 text-sm text-fg-secondary">{i.body}</p>}
              </div>
              <span className={cn('text-xs font-medium', i.resolvedAt ? 'text-success' : 'text-danger')}>{i.resolvedAt ? s.resolved : s.ongoing}</span>
              {!i.auto && !i.resolvedAt && <Button size="sm" variant="ghost" onClick={() => saveManual(manual.map(x => x.id === i.id ? { ...x, resolvedAt: new Date().toISOString() } : x))}>{s.markResolved}</Button>}
              {!i.auto && <IconButton size="sm" title={s.deleteIncident} onClick={() => saveManual(manual.filter(x => x.id !== i.id))}><X size={13} /></IconButton>}
            </li>
          ))}
        </ul>
      )}
      {writing && (
        <Modal title={s.writeIncident} onClose={() => setWriting(false)}>
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.incidentTitle}
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={s.incidentTitlePlaceholder} autoFocus />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-fg-secondary">{s.incidentBody}
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={4} />
            </label>
            <p className="text-xs text-fg-secondary">{s.incidentPublic}</p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWriting(false)}>{t.common.cancel}</Button>
              <Button disabled={!title.trim()} onClick={publish}>{s.publish}</Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  )
}
