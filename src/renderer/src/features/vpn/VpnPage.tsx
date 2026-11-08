import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Download, ExternalLink, KeyRound, Laptop, LogOut, Plus, QrCode, RefreshCw, Search, ShieldCheck, Smartphone, Tablet, Trash2 } from 'lucide-react'
import type { SSHConnection, VpnClient, VpnDetect, VpnServer } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { pressable } from '@renderer/lib/a11y'
import { formatDate, formatRelative, formatSize } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Modal from '@renderer/components/ui/Modal'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import Switch from '@renderer/components/ui/Switch'
import Spinner from '@renderer/components/ui/Spinner'
import { Input } from '@renderer/components/ui/Input'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { ServerSelect, useServerPicker } from '@renderer/features/vps/ServerPicker'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import Notice from '@renderer/components/ui/Notice'

/** Clients refresh while the page is open: transfers and last handshakes move */
const REFRESH_MS = 15_000
/** A handshake this recent: the device is connected */
const LIVE_MS = 3 * 60_000
/** The QR code holds the device's private key: it closes by itself */
const QR_MS = 2 * 60_000
/** Over this many devices, a search above the table */
const SEARCH_FROM = 8

export default function VpnPage() {
  const { t } = useI18n()
  const picker = useServerPicker()
  const { connections, conn } = picker
  const [servers, setServers] = useState<VpnServer[]>([])

  const refreshServers = useCallback(() => window.devforge.vpn.servers().then(setServers).catch(() => {}), [])
  useEffect(() => { refreshServers() }, [refreshServers])
  const select = <ServerSelect connections={connections} value={picker.serverId} onChange={picker.setServerId} />

  return (
    <Page className="df-mockup">
      {!connections || !conn ? (
        <>
          <PageHeader crumb={t.nav.groupOnline} title="VPN" subtitle={t.vpn.subtitle} />
          {!connections ? <Spinner /> : <NeedsSetup service="server" />}
        </>
      ) : <Server key={conn.id} conn={conn} saved={servers.find(s => s.connectionId === conn.id)} select={select} onChange={refreshServers} />}
    </Page>
  )
}

function Server({ conn, saved, select, onChange }: { conn: SSHConnection; saved: VpnServer | undefined; select: ReactNode; onChange: () => void }) {
  const { t } = useI18n()
  const v = t.vpn
  const [found, setFound] = useState<VpnDetect | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { window.devforge.vpn.detect(conn.id).then(setFound).catch(err => setError(errorText(err))) }, [conn.id])

  if (saved && found?.found && found.supported && found.port) return <Clients conn={conn} found={found} select={select} onForget={onChange} />
  return (
    <>
      <PageHeader crumb={`${t.nav.groupOnline} · ${conn.name}`} title="VPN" subtitle={v.subtitle} actions={select} />
      {error ? <Notice tone="warning" className="max-w-2xl">{error}</Notice>
        : !found ? <p className="flex items-center gap-2 text-sm text-fg-muted"><Spinner /> {v.checking}</p>
        : !found.found ? <Notice tone="warning" className="max-w-2xl">{v.notFound}</Notice>
        : !found.supported ? <Notice tone="warning" className="max-w-2xl">{v.unsupported.replace('{version}', found.version ?? '?')}</Notice>
        : !found.port ? <Notice tone="warning" className="max-w-2xl">{v.noPort}</Notice>
        : <Login conn={conn} port={found.port} onDone={onChange} />}
    </>
  )
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
        <div className="flex size-11 items-center justify-center rounded-xl bg-forgy-soft"><ShieldCheck size={22} aria-hidden className="text-forgy" /></div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{v.loginTitle}</h2>
          <p className="mt-0.5 text-sm text-fg-secondary">{v.loginHint}</p>
        </div>
      </div>
      <form className="flex flex-col gap-3" onSubmit={e => { e.preventDefault(); if (username.trim() && password) connect() }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{v.username}
            <Input value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{v.password}
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="off" />
          </label>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={!username.trim() || !password} loading={busy}>{!busy && <KeyRound size={14} aria-hidden />} {v.connect}</Button>
        </div>
      </form>
    </Card>
  )
}

// ─── Clients ──────────────────────────────────────────────────────────────────

/** Its last handshake is recent: the device is on the VPN now */
const isLive = (c: VpnClient) => !!c.latestHandshakeAt && Date.now() - new Date(c.latestHandshakeAt).getTime() < LIVE_MS

/** A phone, a tablet or a computer, guessed from its name */
function DeviceIcon({ name }: { name: string }) {
  const Icon = /phone|t[ée]l[ée]phone|iphone|android|pixel|galaxy|mobile/i.test(name) ? Smartphone
    : /ipad|tablet|tablette/i.test(name) ? Tablet : Laptop
  return <Icon size={14} aria-hidden className="shrink-0 text-fg-muted" />
}

/**
 * As in the mock-up: the devices in a table (address, last connection,
 * transfers, on / off), the QR code of the one picked beside them, « New
 * client » in the header.
 */
function Clients({ conn, found, select, onForget }: { conn: SSHConnection; found: VpnDetect; select: ReactNode; onForget: () => void }) {
  const { t, lang } = useI18n()
  const v = t.vpn
  const toast = useToast()
  const [clients, setClients] = useState<VpnClient[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [picked, setPicked] = useState<number | null>(null)
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
    const rank = (c: VpnClient) => (isLive(c) ? 0 : c.enabled ? 1 : 2)
    return (clients ?? []).filter(c => !q || c.name.toLowerCase().includes(q) || c.ipv4.includes(q)).sort((a, b) => rank(a) - rank(b))
  }, [clients, filter])

  async function act(fn: () => Promise<unknown>) {
    try { await fn() } catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { load() }
  }

  // A QR code asked from elsewhere (Forgy created the client): that device is picked
  useEffect(() => {
    const check = () => {
      let wanted: { connectionId: string; clientId: number } | null = null
      try { wanted = JSON.parse(sessionStorage.getItem('devforge:vpn-qr') ?? 'null') } catch { /* none */ }
      if (!wanted || wanted.connectionId !== conn.id) return
      sessionStorage.removeItem('devforge:vpn-qr')
      load()
      setPicked(wanted.clientId)
    }
    check()
    window.addEventListener('devforge:vpn-qr', check)
    return () => window.removeEventListener('devforge:vpn-qr', check)
  }, [conn.id, load])

  async function openWeb() {
    try { window.devforge.openExternal(await window.devforge.vpn.openWeb(conn.id)) }
    catch (err) { toast.show({ tone: 'error', title: say(err) }) }
  }
  async function forget() {
    if ((await confirmDialog(v.forgetConfirm.replace('{name}', conn.name), { danger: true }))) { await window.devforge.vpn.forget(conn.id); onForget() }
  }

  const count = clients?.length ?? 0
  const pickedClient = clients?.find(c => c.id === picked) ?? null
  const title = (
    <span className="flex min-w-0 items-center gap-3">VPN <span title={v.found.replace('{version}', found.version ?? 'latest').replace('{port}', String(found.port))}><Badge dot color="success">{v.active}</Badge></span></span>
  )

  return (
    <>
      <PageHeader crumb={`${t.nav.groupOnline} · ${conn.name}`} title={title}
        subtitle={clients ? `${v.subtitle} ${(count === 1 || (lang !== 'en' && count === 0) ? v.devicesOne : v.devicesMany).replace('{n}', String(count))}` : v.subtitle}
        actions={<>
          {select}
          {count > SEARCH_FROM && (
            <label className="relative">
              <span className="sr-only">{v.search}</span>
              <Search size={14} aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
              <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder={v.search} className="w-56 pl-8" />
            </label>
          )}
          <Button onClick={() => setCreating(true)}><Plus size={14} aria-hidden /> {v.newClient}</Button>
          <MoreMenu label={v.more} items={[
            { label: v.openWeb, icon: ExternalLink, onSelect: openWeb },
            { label: v.refresh, icon: RefreshCw, onSelect: () => { load() } },
            { label: v.forget, icon: LogOut, danger: true, onSelect: forget }
          ]} />
        </>} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          {error ? <p className="px-4.5 py-4 text-sm text-danger">{error}</p>
            : !clients ? <div className="p-4.5"><Spinner /></div>
            : shown.length === 0 ? <p className="px-4.5 py-4 text-sm text-fg-muted">{clients.length ? v.noMatch : v.noClients}</p>
            : (
              <Table>
                <thead>
                  <tr>
                    <Th className="pl-4.5">{v.colDevice}</Th>
                    <Th>{v.colAddress}</Th>
                    <Th>{v.colLast}</Th>
                    <Th>{v.colTransfer}</Th>
                    <Th align="right" className="pr-4.5">{v.colActive}</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(c => {
                    const expired = !!c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()
                    const live = isLive(c)
                    const choose = () => setPicked(p => (p === c.id ? null : c.id))
                    return (
                      <tr key={c.id} onClick={choose} {...pressable(choose)} aria-selected={picked === c.id}
                        className={cn('cursor-pointer', picked === c.id && '[&>td]:bg-elevated')}>
                        <Td className="min-w-[200px] pl-4.5">
                          <span className={cn('flex items-center gap-2.5', c.enabled ? 'font-semibold text-fg' : 'text-fg-secondary')}>
                            <DeviceIcon name={c.name} />
                            <span className="truncate">{c.name}</span>
                          </span>
                          {c.expiresAt && (
                            <span className={cn('mt-0.5 block pl-6 text-xs', expired ? 'text-danger' : 'text-fg-muted')}>
                              {expired ? v.expired : v.expires.replace('{date}', formatDate(c.expiresAt, lang))}
                            </span>
                          )}
                        </Td>
                        <Td className={cn('font-mono whitespace-nowrap', c.enabled ? 'text-fg' : 'text-fg-muted')}>{c.ipv4}</Td>
                        <Td className="whitespace-nowrap">
                          {live ? <Badge dot color="success">{v.connected}</Badge>
                            : <span className="text-fg-secondary">{c.latestHandshakeAt ? formatRelative(c.latestHandshakeAt, lang) : v.never}</span>}
                        </Td>
                        <Td className="font-mono text-xs whitespace-nowrap text-fg">
                          {c.transferRx == null && c.transferTx == null ? <span className="text-fg-muted">—</span> : (
                            <span className="inline-flex items-center gap-2.5">
                              <span className="inline-flex items-center gap-1" title={v.received}><ArrowDown size={12} aria-hidden />{formatSize(c.transferTx)}</span>
                              <span className="inline-flex items-center gap-1" title={v.sent}><ArrowUp size={12} aria-hidden />{formatSize(c.transferRx)}</span>
                            </span>
                          )}
                        </Td>
                        <Td align="right" className="pr-4.5" onClick={e => e.stopPropagation()}>
                          <span className="inline-flex">
                            <Switch checked={c.enabled} label={v.enable.replace('{name}', c.name)}
                              onChange={enabled => act(() => window.devforge.vpn.setEnabled(conn.id, c.id, enabled))} />
                          </span>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
        </Card>

        <QrPanel key={pickedClient?.id ?? 'none'} conn={conn} client={pickedClient} say={say}
          onRemoved={() => { setPicked(null); load() }} />
      </div>

      {creating && <CreateClient conn={conn} onClose={() => setCreating(false)} onCreated={async id => {
        setCreating(false)
        await load()
        setPicked(id)
      }} />}
    </>
  )
}

/** The picked device: its QR code (closed after two minutes), its .conf file, remove */
function QrPanel({ conn, client, say, onRemoved }: { conn: SSHConnection; client: VpnClient | null; say: (err: unknown) => string; onRemoved: () => void }) {
  const { t } = useI18n()
  const v = t.vpn
  const toast = useToast()
  const [qr, setQr] = useState<string | null>(null)
  const [closed, setClosed] = useState(false)
  const [busy, setBusy] = useState(false)

  const show = useCallback(async () => {
    if (!client) return
    setClosed(false)
    setBusy(true)
    try { setQr(await window.devforge.vpn.qrcode(conn.id, client.id)) } catch (err) { toast.show({ tone: 'error', title: say(err) }) }
    finally { setBusy(false) }
  }, [client, conn.id, say, toast])
  useEffect(() => { show() }, [show])
  useEffect(() => {
    if (!qr) return
    const id = setTimeout(() => { setQr(null); setClosed(true) }, QR_MS)
    return () => clearTimeout(id)
  }, [qr])

  if (!client) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex size-11 items-center justify-center rounded-xl bg-active text-fg-secondary"><QrCode size={20} aria-hidden /></span>
        <p className="max-w-[240px] text-sm text-fg-secondary">{v.pickClient}</p>
      </Card>
    )
  }

  async function download() {
    try {
      const file = await window.devforge.vpn.saveConfig(conn.id, client!.id)
      if (file) toast.show({ tone: 'success', title: v.saved.replace('{file}', file) })
    } catch (err) { toast.show({ tone: 'error', title: say(err) }) }
  }
  async function remove() {
    if (!(await confirmDialog(v.removeConfirm.replace('{name}', client!.name), { danger: true }))) return
    try { await window.devforge.vpn.remove(conn.id, client!.id); toast.show({ tone: 'success', title: v.removed.replace('{name}', client!.name) }); onRemoved() }
    catch (err) { toast.show({ tone: 'error', title: say(err) }) }
  }

  return (
    <Card className="flex flex-col items-center gap-4 p-5 text-center">
      <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{client.name}</h2>
      {qr ? (
        <div className="rounded-xl bg-white p-3">
          <img src={qr} alt={v.qrTitle.replace('{name}', client.name)} className="size-48" style={{ imageRendering: 'pixelated' }} />
        </div>
      ) : (
        <div className="flex size-54 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-line">
          {busy ? <Spinner /> : <Button size="sm" variant="secondary" onClick={show}><QrCode size={13} aria-hidden /> {v.showQr}</Button>}
        </div>
      )}
      <p role="status" className="text-sm text-fg-secondary">{closed ? v.qrClosed : v.qrScan}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={download}><Download size={13} aria-hidden /> {v.downloadConf}</Button>
        <Button size="sm" variant="ghost" className="text-danger" onClick={remove}><Trash2 size={13} aria-hidden /> {v.remove}</Button>
      </div>
    </Card>
  )
}

function CreateClient({ conn, onClose, onCreated }: { conn: SSHConnection; onClose: () => void; onCreated: (id: number) => void }) {
  const { t } = useI18n()
  const v = t.vpn
  const [name, setName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true); setError('')
    try { onCreated(await window.devforge.vpn.create(conn.id, name, expiresAt || null)) }
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
        <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{v.name}
          <Input autoFocus value={name} maxLength={64} onChange={e => setName(e.target.value)} placeholder={v.namePlaceholder} />
        </label>
        <label className="flex flex-col gap-1.5 text-base text-fg-secondary">{v.expiresAt}
          <Input type="date" value={expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={e => setExpiresAt(e.target.value)} />
          <span className="text-xs text-fg-muted">{v.expiresHint}</span>
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  )
}
