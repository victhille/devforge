import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Download, ExternalLink, KeyRound, Plus, QrCode, RefreshCw, Search, ShieldCheck, Trash2 } from 'lucide-react'
import type { SSHConnection, VpnClient, VpnDetect, VpnServer } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatDate, formatRelative, formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import Switch from '@renderer/components/ui/Switch'
import Spinner from '@renderer/components/ui/Spinner'
import { Input, Select } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import NeedsSetup from '@renderer/components/NeedsSetup'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
/** Shared with the other VPS pages (Services, Health, Backups) */
const KEY = 'devforge:vps-server'
/** Clients refresh while the page is open: transfers and last handshakes move */
const REFRESH_MS = 15_000

export default function VpnPage() {
  const { t } = useI18n()
  const v = t.vpn
  const [connections, setConnections] = useState<SSHConnection[] | null>(null)
  const [serverId, setServerId] = useState(() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })
  const [servers, setServers] = useState<VpnServer[]>([])

  useEffect(() => {
    window.devforge.getSshConnections().then(c => {
      setConnections(c)
      setServerId(prev => (c.some(x => x.id === prev) ? prev : c[0]?.id ?? ''))
    }).catch(() => setConnections([]))
    window.devforge.vpn.servers().then(setServers).catch(() => {})
  }, [])
  useEffect(() => { try { if (serverId) localStorage.setItem(KEY, serverId) } catch { /* not kept */ } }, [serverId])
  const refreshServers = useCallback(() => window.devforge.vpn.servers().then(setServers).catch(() => {}), [])

  const conn = connections?.find(c => c.id === serverId)
  const saved = servers.find(s => s.connectionId === serverId)

  return (
    <Page>
      <PageHeader title="VPN" subtitle={v.subtitle}
        actions={connections && connections.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-fg-secondary">
            {v.server}
            <Select value={serverId} onChange={e => setServerId(e.target.value)} className="w-64">
              {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.host}</option>)}
            </Select>
          </label>
        )} />
      {!connections ? <Spinner /> : !conn ? <NeedsSetup service="server" /> : <Server key={conn.id} conn={conn} saved={saved} onChange={refreshServers} />}
    </Page>
  )
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="flex max-w-2xl items-start gap-2 rounded-[10px] bg-warning-soft px-3 py-2.5 text-[13px] text-fg"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-warning" /> {children}</p>
}

function Server({ conn, saved, onChange }: { conn: SSHConnection; saved: VpnServer | undefined; onChange: () => void }) {
  const { t } = useI18n()
  const v = t.vpn
  const [found, setFound] = useState<VpnDetect | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { window.devforge.vpn.detect(conn.id).then(setFound).catch(err => setError(errorText(err))) }, [conn.id])

  if (error) return <Notice>{error}</Notice>
  if (!found) return <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {v.checking}</p>
  if (!found.found) return <Notice>{v.notFound}</Notice>
  if (!found.supported) return <Notice>{v.unsupported.replace('{version}', found.version ?? '?')}</Notice>
  if (!found.port) return <Notice>{v.noPort}</Notice>
  return saved ? <Clients conn={conn} found={found} onForget={onChange} /> : <Login conn={conn} port={found.port} onDone={onChange} />
}

// ─── Login ────────────────────────────────────────────────────────────────────

function Login({ conn, port, onDone }: { conn: SSHConnection; port: number; onDone: () => void }) {
  const { t } = useI18n()
  const v = t.vpn
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function connect() {
    setBusy(true); setError('')
    try { await window.devforge.vpn.saveLogin(conn.id, port, username, password); setPassword(''); onDone() }
    catch (err) { const e = errorText(err); setError(e === 'BAD_LOGIN' ? v.badLogin : e) }
    finally { setBusy(false) }
  }

  return (
    <Card className="df-rise flex max-w-xl flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-forgy-soft"><ShieldCheck size={22} className="text-forgy" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-fg">{v.loginTitle}</h2>
          <p className="mt-0.5 text-[12.5px] text-fg-secondary">{v.loginHint}</p>
        </div>
      </div>
      <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); if (username.trim() && password) connect() }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{v.username}
            <Input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{v.password}
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" />
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={!username.trim() || !password} loading={busy}>{!busy && <KeyRound size={14} />} {v.connect}</Button>
        </div>
      </form>
    </Card>
  )
}

// ─── Clients ──────────────────────────────────────────────────────────────────

function Clients({ conn, found, onForget }: { conn: SSHConnection; found: VpnDetect; onForget: () => void }) {
  const { t, lang } = useI18n()
  const v = t.vpn
  const toast = useToast()
  const [clients, setClients] = useState<VpnClient[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [tunnel, setTunnel] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [qr, setQr] = useState<{ name: string; url: string } | null>(null)
  // "New VPN client" from the command palette opens the form straight away
  const [creating, setCreating] = useState(() => {
    try {
      if (sessionStorage.getItem('devforge:vpn-new') !== conn.id) return false
      sessionStorage.removeItem('devforge:vpn-new')
      return true
    } catch { return false }
  })

  const say = useCallback((err: unknown) => { const e = errorText(err); return e === 'BAD_LOGIN' ? v.badLogin : e }, [v.badLogin])
  const load = useCallback(() => window.devforge.vpn.clients(conn.id).then(c => { setClients(c); setError('') }).catch(err => setError(say(err))), [conn.id, say])
  useEffect(() => {
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (clients ?? []).filter(c => !q || c.name.toLowerCase().includes(q) || c.ipv4.includes(q))
  }, [clients, filter])

  async function act(key: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(key)
    try { await fn(); if (ok) toast.show({ tone: 'success', title: ok }) } catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { setBusy(null); load() }
  }

  async function showQr(c: VpnClient) {
    setBusy(`qr-${c.id}`)
    try { setQr({ name: c.name, url: await window.devforge.vpn.qrcode(conn.id, c.id) }) } catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { setBusy(null) }
  }

  // A QR code asked from elsewhere (Forgy created the client)
  useEffect(() => {
    const check = () => {
      let wanted: { connectionId: string; clientId: number } | null = null
      try { wanted = JSON.parse(sessionStorage.getItem('devforge:vpn-qr') ?? 'null') } catch { /* none */ }
      if (!wanted || wanted.connectionId !== conn.id) return
      sessionStorage.removeItem('devforge:vpn-qr')
      window.devforge.vpn.clients(conn.id).then(list => {
        setClients(list)
        const c = list.find(x => x.id === wanted!.clientId)
        if (c) showQr(c)
      }).catch(() => {})
    }
    check()
    window.addEventListener('devforge:vpn-qr', check)
    return () => window.removeEventListener('devforge:vpn-qr', check)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id])

  async function openWeb() {
    setBusy('web')
    try { const url = await window.devforge.vpn.openWeb(conn.id); setTunnel(url); window.devforge.openExternal(url) }
    catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="df-rise flex flex-wrap items-center gap-4 p-5">
        <div className="flex size-12 items-center justify-center rounded-[14px] bg-forgy-soft"><ShieldCheck size={26} className="text-forgy" /></div>
        <div className="min-w-[220px] flex-1">
          <h2 className="text-lg font-semibold text-fg">WireGuard</h2>
          <div className="mt-1 font-mono text-xs text-fg-muted">
            {v.found.replace('{version}', found.version ?? 'latest').replace('{port}', String(found.port))}{tunnel && ` · ${v.tunnelOpen.replace('{url}', tunnel)}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === 'web'} onClick={openWeb} title={v.openWebHint}>{busy !== 'web' && <ExternalLink size={14} />} {v.openWeb}</Button>
          <Button variant="ghost" onClick={() => load()}><RefreshCw size={14} /> {v.refresh}</Button>
        </div>
      </Card>

      <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
        <div className="flex flex-wrap items-center gap-3 px-[18px] pt-4 pb-3">
          <h3 className="flex-1 text-md font-semibold text-fg">{v.clients}{clients && <span className="ml-2 font-mono text-xs text-fg-muted">{clients.length}</span>}</h3>
          <label className="relative">
            <span className="sr-only">{v.search}</span>
            <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder={v.search} className="w-56 pl-8" />
          </label>
          <Button onClick={() => setCreating(true)}><Plus size={14} /> {v.newClient}</Button>
        </div>
        {error ? <p className="border-t border-line-subtle px-[18px] py-4 text-sm text-danger">{error}</p>
          : !clients ? <div className="border-t border-line-subtle p-[18px]"><Spinner /></div>
          : shown.length === 0 ? <p className="border-t border-line-subtle px-[18px] py-4 text-sm text-fg-muted">{clients.length ? v.noMatch : v.noClients}</p>
          : shown.map(c => {
            const expired = !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()
            return (
              <div key={c.id} className={cn('flex flex-wrap items-center gap-3 border-t border-line-subtle px-[18px] py-3', !c.enabled && 'opacity-60')}>
                <div aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-active text-sm font-semibold text-fg-secondary">{c.name.slice(0, 1).toUpperCase() || '?'}</div>
                <div className="min-w-[200px] flex-1">
                  <div className="truncate text-sm font-medium text-fg">{c.name}</div>
                  <div className="truncate font-mono text-[11.5px] text-fg-muted">{c.ipv4}{c.ipv6 ? `, ${c.ipv6}` : ''}</div>
                  <div className="text-xs text-fg-muted">
                    {c.latestHandshakeAt ? v.lastSeen.replace('{when}', formatRelative(c.latestHandshakeAt, lang)) : v.never}
                    {' · '}
                    {c.expiresAt ? <span className={cn(expired && 'text-danger')}>{expired ? v.expired : v.expires.replace('{date}', formatDate(c.expiresAt))}</span> : v.permanent}
                  </div>
                </div>
                {(c.transferRx != null || c.transferTx != null) && (
                  <div className="flex w-40 shrink-0 gap-3 font-mono text-[11.5px] text-fg-secondary">
                    <span className="flex items-center gap-1" title="↓"><ArrowDown size={12} aria-hidden />{formatSize(c.transferTx)}</span>
                    <span className="flex items-center gap-1" title="↑"><ArrowUp size={12} aria-hidden />{formatSize(c.transferRx)}</span>
                  </div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={c.enabled} label={v.enable.replace('{name}', c.name)}
                    onChange={enabled => act(`en-${c.id}`, () => window.devforge.vpn.setEnabled(conn.id, c.id, enabled))} />
                  <IconButton title={v.qr} disabled={busy === `qr-${c.id}`} onClick={() => showQr(c)}><QrCode size={15} /></IconButton>
                  <IconButton title={v.download} onClick={() => act(`dl-${c.id}`, async () => {
                    const file = await window.devforge.vpn.saveConfig(conn.id, c.id)
                    if (file) toast.show({ tone: 'success', title: v.saved.replace('{file}', file) })
                  })}><Download size={15} /></IconButton>
                  <IconButton title={v.remove} tone="danger" disabled={busy === `rm-${c.id}`}
                    onClick={() => { if (window.confirm(v.removeConfirm.replace('{name}', c.name))) act(`rm-${c.id}`, () => window.devforge.vpn.remove(conn.id, c.id), v.removed.replace('{name}', c.name)) }}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
            )
          })}
      </Card>

      <button onClick={async () => { if (window.confirm(v.forgetConfirm.replace('{name}', conn.name))) { await window.devforge.vpn.forget(conn.id); onForget() } }}
        className="self-start text-xs text-fg-muted hover:text-danger">{v.forget}</button>

      {qr && (
        <Modal title={v.qrTitle.replace('{name}', qr.name)} onClose={() => setQr(null)} footer={<Button variant="secondary" onClick={() => setQr(null)}>{v.close}</Button>}>
          <div className="flex justify-center rounded-lg bg-white p-4">
            <img src={qr.url} alt={v.qrTitle.replace('{name}', qr.name)} className="size-64" style={{ imageRendering: 'pixelated' }} />
          </div>
          <p className="text-xs text-fg-secondary">{v.qrHint}</p>
        </Modal>
      )}

      {creating && <CreateClient conn={conn} onClose={() => setCreating(false)} onCreated={async (id, name) => {
        setCreating(false)
        await load()
        try { setQr({ name, url: await window.devforge.vpn.qrcode(conn.id, id) }) } catch (err) { toast.show({ tone: 'error', title: say(err) }) }
      }} />}
    </div>
  )
}

function CreateClient({ conn, onClose, onCreated }: { conn: SSHConnection; onClose: () => void; onCreated: (id: number, name: string) => void }) {
  const { t } = useI18n()
  const v = t.vpn
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true); setError('')
    try { onCreated(await window.devforge.vpn.create(conn.id, name, expiresAt || null), name.trim()) }
    catch (err) { setError(errorText(err)) }
    finally { setBusy(false) }
  }

  return (
    <Modal title={v.createTitle} onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>{v.cancel}</Button>
        <Button disabled={!name.trim()} loading={busy} onClick={create}>{v.create}</Button>
      </>}>
      <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); if (name.trim()) create() }}>
        <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{v.name}
          <Input autoFocus value={name} maxLength={64} onChange={e => setName(e.target.value)} placeholder={v.namePlaceholder} />
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] text-fg-secondary">{v.expiresAt}
          <Input type="date" value={expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={e => setExpiresAt(e.target.value)} />
          <span className="text-xs text-fg-muted">{v.expiresHint}</span>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
