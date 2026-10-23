import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { BackupState, HealthLevel, N8nStatus, SSHConnection, VpnClient, VpsHealth, VpsService } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatRelative, formatSize } from '@renderer/lib/format'
import Spinner from '@renderer/components/ui/Spinner'
import { Dot, Pill, SmallButton, Tile } from './parts'

/**
 * Home widgets about the VPS: they read the server the VPS pages show
 * (the last one picked), through DevForge's SSH session.
 */

const KEY = 'devforge:vps-server'
const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** The server of the VPS pages, else the first one; null when none is saved */
export function useVpsServer(): SSHConnection | null | undefined {
  const [conn, setConn] = useState<SSHConnection | null | undefined>(undefined)
  useEffect(() => {
    let id = ''
    try { id = localStorage.getItem(KEY) ?? '' } catch { /* none */ }
    window.devforge.getSshConnections().then(list => setConn(list.find(c => c.id === id) ?? list[0] ?? null)).catch(() => setConn(null))
  }, [])
  return conn
}

const pick = (id: string) => { try { localStorage.setItem(KEY, id) } catch { /* not kept */ } }

function NoServer({ i, title }: { i: number; title: string }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Tile i={i} title={title}>
      <p className="text-sm text-fg-muted">{t.home.noServer}</p>
      <SmallButton className="mt-auto" onClick={() => navigate('/ssh')}>{t.home.addServer}</SmallButton>
    </Tile>
  )
}

const TONE: Record<HealthLevel, 'success' | 'warning' | 'accent' | 'muted'> = { ok: 'success', warn: 'warning', bad: 'warning', unknown: 'muted' }

export function HealthWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const navigate = useNavigate()
  const conn = useVpsServer()
  const [h, setH] = useState<VpsHealth | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { if (conn) window.devforge.vpsOps.health(conn.id).then(setH).catch(e => setError(errorText(e))) }, [conn])
  if (conn === null) return <NoServer i={i} title={w.names.health} />
  const issues = (h?.checks ?? []).filter(c => c.level === 'bad' || c.level === 'warn').sort((a, b) => (a.level === 'bad' ? -1 : 0) - (b.level === 'bad' ? -1 : 0))
  const level: HealthLevel = !h ? 'unknown' : issues[0]?.level ?? 'ok'
  return (
    <Tile i={i} title={`${w.names.health}${conn ? ` · ${conn.name}` : ''}`} aside={h && <Pill tone={TONE[level]}>{t.vpsOps.summary[level]}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : !h ? <Spinner /> : issues.length === 0 ? <p className="text-sm text-fg-secondary">{w.healthOk}</p> : (
        <ul className="flex flex-col gap-1.5 text-base">
          {issues.slice(0, 4).map(c => (
            <li key={c.id} className="flex items-center gap-2.5">
              <span className={c.level === 'bad' ? 'size-2 shrink-0 rounded-full bg-danger' : 'size-2 shrink-0 rounded-full bg-warning'} />
              <span className="truncate text-fg">{(t.vpsOps.checks as Record<string, { title: string }>)[c.id]?.title ?? c.id}</span>
            </li>
          ))}
        </ul>
      )}
      <SmallButton className="mt-auto" disabled={!conn} onClick={() => { if (conn) pick(conn.id); navigate('/health') }}>{w.healthOpen}</SmallButton>
    </Tile>
  )
}

export function ServicesWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const toast = useToast()
  const conn = useVpsServer()
  const [list, setList] = useState<VpsService[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { if (conn) window.devforge.vpsOps.services(conn.id).then(setList).catch(e => setError(errorText(e))) }, [conn])
  if (conn === null) return <NoServer i={i} title={w.names.services} />
  return (
    <Tile i={i} title={`${w.names.services}${conn ? ` · ${conn.name}` : ''}`}>
      {error ? <p className="text-sm text-danger">{error}</p> : !list ? <Spinner /> : list.length === 0 ? <p className="text-sm text-fg-muted">{w.servicesNone}</p> : (
        <div className="flex flex-col gap-2 text-base">
          {list.slice(0, 6).map((s, n) => (
            <div key={`${s.container}:${s.port}`} className="flex items-center gap-2.5">
              <Dot live={s.running} delay={n * 0.4} />
              <span className="flex-1 truncate text-fg">{s.name}</span>
              {s.exposed && <Pill tone="warning">{t.vpsOps.exposed}</Pill>}
              <SmallButton className="px-2.5" disabled={!s.running || !conn} onClick={async () => {
                try { window.devforge.openExternal(await window.devforge.vpsOps.openService(conn!.id, s.port, s.scheme)) } catch (e) { toast.show({ tone: 'error', title: errorText(e) }) }
              }}>{w.open}</SmallButton>
            </div>
          ))}
        </div>
      )}
    </Tile>
  )
}

export function BackupsWidget({ i }: { i: number }) {
  const { t, lang } = useI18n()
  const w = t.home.widgets
  const navigate = useNavigate()
  const conn = useVpsServer()
  const [st, setSt] = useState<BackupState | null | 'off'>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!conn) return
    window.devforge.backups.plans().then(plans => {
      if (!plans.some(p => p.connectionId === conn.id)) { setSt('off'); return }
      window.devforge.backups.state(conn.id).then(setSt).catch(e => setError(errorText(e)))
    }).catch(e => setError(errorText(e)))
  }, [conn])
  if (conn === null) return <NoServer i={i} title={w.names.backups} />
  const last = st && st !== 'off' ? st.last : null
  const stale = last ? (Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000 > 36 : false
  return (
    <Tile i={i} title={`${w.names.backups}${conn ? ` · ${conn.name}` : ''}`}
      aside={last && <Pill tone={!last.ok || stale ? 'warning' : 'success'}>{last.ok ? (stale ? t.vpsOps.summary.warn : 'OK') : w.backupsFailed}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : st === null ? <Spinner /> : st === 'off' ? <p className="text-sm text-fg-muted">{w.backupsOff}</p>
        : !last ? <p className="text-sm text-fg-muted">{w.backupsNone}</p>
        : <p className="text-sm text-fg-secondary">{w.backupsLast.replace('{when}', formatRelative(last.finishedAt, lang)).replace('{size}', formatSize(last.size))}</p>}
      {st !== 'off' && st && st.local.day && <p className="text-xs text-fg-muted">{t.backups.localCopy.replace('{day}', st.local.day)}</p>}
      <SmallButton className="mt-auto" disabled={!conn} onClick={() => { if (conn) pick(conn.id); navigate('/backups') }}>{st === 'off' ? w.backupsSetup : w.backupsOpen}</SmallButton>
    </Tile>
  )
}

export function N8nWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const navigate = useNavigate()
  const toast = useToast()
  const conn = useVpsServer()
  const [status, setStatus] = useState<N8nStatus | null | 'none'>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!conn) return
    window.devforge.n8n.instances().then(list => {
      if (!list.some(x => x.connectionId === conn.id)) { setStatus('none'); return }
      window.devforge.n8n.status(conn.id).then(setStatus).catch(e => setError(errorText(e)))
    }).catch(e => setError(errorText(e)))
  }, [conn])
  if (conn === null) return <NoServer i={i} title="n8n" />
  const on = status && status !== 'none' && status.state === 'running'
  return (
    <Tile i={i} title={`n8n${status && status !== 'none' && status.version ? ` ${status.version}` : ''}`}
      aside={status && status !== 'none' && <Pill tone={on ? 'success' : 'muted'}>{on ? t.n8n.running : t.n8n.stopped}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : status === null ? <Spinner /> : status === 'none' ? <p className="text-sm text-fg-muted">{w.n8nNone}</p> : null}
      <div className="mt-auto flex gap-2">
        <SmallButton className="flex-1" onClick={() => navigate('/n8n')}>{w.manage}</SmallButton>
        {on && conn && (
          <SmallButton className="flex-1" onClick={async () => {
            try { window.devforge.openExternal(status.url ?? await window.devforge.n8n.openTunnel(conn.id)) } catch (e) { toast.show({ tone: 'error', title: errorText(e) }) }
          }}>{w.open}</SmallButton>
        )}
      </div>
    </Tile>
  )
}

/** A device counts as connected when its last WireGuard handshake is under 3 minutes old */
const ONLINE_MS = 3 * 60_000

export function VpnWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const navigate = useNavigate()
  const conn = useVpsServer()
  const [clients, setClients] = useState<VpnClient[] | null | 'none'>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!conn) return
    window.devforge.vpn.servers().then(list => {
      if (!list.some(x => x.connectionId === conn.id)) { setClients('none'); return }
      window.devforge.vpn.clients(conn.id).then(setClients).catch(e => setError(errorText(e) === 'BAD_LOGIN' ? t.vpn.badLogin : errorText(e)))
    }).catch(e => setError(errorText(e)))
  }, [conn, t.vpn.badLogin])
  if (conn === null) return <NoServer i={i} title="VPN" />
  const online = clients && clients !== 'none' ? clients.filter(c => c.latestHandshakeAt && Date.now() - new Date(c.latestHandshakeAt).getTime() < ONLINE_MS) : []
  return (
    <Tile i={i} title={`VPN${conn ? ` · ${conn.name}` : ''}`} aside={clients && clients !== 'none' && <Pill tone={online.length ? 'success' : 'muted'}>{w.vpnOnline.replace('{n}', String(online.length))}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : clients === null ? <Spinner /> : clients === 'none' ? <p className="text-sm text-fg-muted">{w.vpnNoLogin}</p> : (
        <div className="flex flex-col gap-2 text-base">
          {clients.slice(0, 5).map((c, n) => (
            <div key={c.id} className="flex items-center gap-2.5">
              <Dot live={online.includes(c)} delay={n * 0.4} />
              <span className="flex-1 truncate text-fg">{c.name}</span>
              <span className="font-mono text-xs text-fg-muted">{c.ipv4}</span>
            </div>
          ))}
        </div>
      )}
      <SmallButton className="mt-auto" onClick={() => { if (conn) pick(conn.id); navigate('/vpn') }}>{w.manage}</SmallButton>
    </Tile>
  )
}
