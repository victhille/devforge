import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppWindow, ArrowRight, Archive, HeartPulse, ShieldCheck, Workflow, type LucideIcon } from 'lucide-react'
import type { BackupState, HealthLevel, N8nStatus, SSHConnection, VpnClient, VpsHealth, VpsService } from '@shared/types'
import { useSshConnections } from '@renderer/hooks/useLiveData'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatRelative, formatSize } from '@renderer/lib/format'
import { Dot, Pill, ROW, SmallButton, Tile, TileActions, TileLink, TileLoading } from './parts'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { errorText } from '@renderer/lib/errors'
import StatusDot from '@renderer/components/ui/StatusDot'

/**
 * Home widgets about the VPS: they read the server the VPS pages show
 * (the last one picked), through DevForge's SSH session. Each names the
 * server on the line under its title.
 */

const KEY = 'devforge:vps-server'

/** The server of the VPS pages, else the first one; null when none is saved */
export function useVpsServer(): SSHConnection | null | undefined {
  const { data, error } = useSshConnections()
  return useMemo(() => {
    if (!data) return error ? null : undefined
    let id = ''
    try { id = localStorage.getItem(KEY) ?? '' } catch { /* none */ }
    return data.find(c => c.id === id) ?? data[0] ?? null
  }, [data, error])
}

const pick = (id: string) => { try { localStorage.setItem(KEY, id) } catch { /* not kept */ } }

function NoServer({ i, title, icon }: { i: number; title: string; icon: LucideIcon }) {
  return (
    <Tile i={i} icon={icon} title={title}>
      <NeedsSetup service="server" compact />
    </Tile>
  )
}

const TONE: Record<HealthLevel, 'success' | 'warning' | 'danger' | 'muted'> = { ok: 'success', warn: 'warning', bad: 'danger', unknown: 'muted' }

export function HealthWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const navigate = useNavigate()
  const conn = useVpsServer()
  const [h, setH] = useState<VpsHealth | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { if (conn) window.devforge.vpsOps.health(conn.id).then(setH).catch(e => setError(errorText(e))) }, [conn])
  if (conn === null) return <NoServer i={i} icon={HeartPulse} title={w.names.health} />
  const issues = (h?.checks ?? []).filter(c => c.level === 'bad' || c.level === 'warn').sort((a, b) => (a.level === 'bad' ? -1 : 0) - (b.level === 'bad' ? -1 : 0))
  const level: HealthLevel = !h ? 'unknown' : issues[0]?.level ?? 'ok'
  return (
    <Tile i={i} icon={HeartPulse} title={w.names.health} sub={conn?.name} aside={h && <Pill tone={TONE[level]}>{t.vpsOps.summary[level]}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : !h ? <TileLoading /> : issues.length === 0 ? <p className="text-sm text-fg-secondary">{w.healthOk}</p> : (
        <ul className="flex flex-col text-base">
          {issues.slice(0, 4).map(c => (
            <li key={c.id} className={ROW}>
              <StatusDot state={c.level === 'bad' ? 'error' : 'warn'} />
              <span className="truncate text-fg">{(t.vpsOps.checks as Record<string, { title: string }>)[c.id]?.title ?? c.id}</span>
            </li>
          ))}
        </ul>
      )}
      <TileActions>
        <SmallButton disabled={!conn} onClick={() => { if (conn) pick(conn.id); navigate('/health') }}>{w.healthOpen}</SmallButton>
      </TileActions>
    </Tile>
  )
}

export function ServicesWidget({ i }: { i: number }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const navigate = useNavigate()
  const toast = useToast()
  const conn = useVpsServer()
  const [list, setList] = useState<VpsService[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { if (conn) window.devforge.vpsOps.services(conn.id).then(setList).catch(e => setError(errorText(e))) }, [conn])
  if (conn === null) return <NoServer i={i} icon={AppWindow} title={w.names.services} />
  return (
    <Tile i={i} icon={AppWindow} title={w.names.services} sub={conn?.name}
      aside={<TileLink disabled={!conn} onClick={() => { if (conn) pick(conn.id); navigate('/services') }}>{w.manage} <ArrowRight size={14} aria-hidden /></TileLink>}>
      {error ? <p className="text-sm text-danger">{error}</p> : !list ? <TileLoading /> : list.length === 0 ? <p className="text-sm text-fg-muted">{w.servicesNone}</p> : (
        <ul className="flex flex-col text-base">
          {list.slice(0, 6).map((s, n) => (
            <li key={`${s.container}:${s.port}`} className={ROW}>
              <Dot live={s.running} delay={n * 0.4} />
              <span className="flex-1 truncate text-fg">{s.name}</span>
              {s.exposed && <Pill tone="warning">{t.vpsOps.exposed}</Pill>}
              <SmallButton className="h-8 px-3" aria-label={`${w.open} ${s.name}`} disabled={!s.running || !conn} onClick={async () => {
                try { window.devforge.openExternal(await window.devforge.vpsOps.openService(conn!.id, s.port, s.scheme)) } catch (e) { toast.show({ tone: 'error', title: errorText(e) }) }
              }}>{w.open}</SmallButton>
            </li>
          ))}
        </ul>
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
  if (conn === null) return <NoServer i={i} icon={Archive} title={w.names.backups} />
  const last = st && st !== 'off' ? st.last : null
  const stale = last ? (Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000 > 36 : false
  return (
    <Tile i={i} icon={Archive} title={w.names.backups} sub={conn?.name}
      aside={last && <Pill tone={!last.ok ? 'danger' : stale ? 'warning' : 'success'}>{last.ok ? (stale ? t.vpsOps.summary.warn : w.backupsOk) : w.backupsFailed}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : st === null ? <TileLoading /> : st === 'off' ? <p className="text-sm text-fg-muted">{w.backupsOff}</p>
        : !last ? <p className="text-sm text-fg-muted">{w.backupsNone}</p>
        : <p className="text-base text-fg-secondary">{w.backupsLast.replace('{when}', formatRelative(last.finishedAt, lang)).replace('{size}', formatSize(last.size, lang))}</p>}
      {st !== 'off' && st && st.local.day && <p className="text-sm text-fg-muted">{t.backups.localCopy.replace('{day}', st.local.day)}</p>}
      <TileActions>
        <SmallButton disabled={!conn} onClick={() => { if (conn) pick(conn.id); navigate('/backups') }}>{st === 'off' ? w.backupsSetup : w.backupsOpen}</SmallButton>
      </TileActions>
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
  if (conn === null) return <NoServer i={i} icon={Workflow} title="n8n" />
  const on = status && status !== 'none' && status.state === 'running'
  const version = status && status !== 'none' ? status.version : ''
  return (
    <Tile i={i} icon={Workflow} title="n8n" sub={conn ? [conn.name, version].filter(Boolean).join(' · ') : undefined}
      aside={status && status !== 'none' && <Pill tone={on ? 'success' : 'muted'}>{on ? t.n8n.running : t.n8n.stopped}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : status === null ? <TileLoading /> : status === 'none' ? <p className="text-sm text-fg-muted">{w.n8nNone}</p> : null}
      <TileActions>
        <SmallButton onClick={() => navigate('/n8n')}>{w.manage}</SmallButton>
        {on && conn && (
          <SmallButton onClick={async () => {
            try { window.devforge.openExternal(status.url ?? await window.devforge.n8n.openTunnel(conn.id)) } catch (e) { toast.show({ tone: 'error', title: errorText(e) }) }
          }}>{w.open}</SmallButton>
        )}
      </TileActions>
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
  if (conn === null) return <NoServer i={i} icon={ShieldCheck} title="VPN" />
  const online = clients && clients !== 'none' ? clients.filter(c => c.latestHandshakeAt && Date.now() - new Date(c.latestHandshakeAt).getTime() < ONLINE_MS) : []
  return (
    <Tile i={i} icon={ShieldCheck} title="VPN" sub={conn?.name}
      aside={clients && clients !== 'none' && <Pill tone={online.length ? 'success' : 'muted'}>{w.vpnOnline.replace('{n}', String(online.length))}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : clients === null ? <TileLoading /> : clients === 'none' ? <p className="text-sm text-fg-muted">{w.vpnNoLogin}</p> : (
        <ul className="flex flex-col text-base">
          {clients.slice(0, 5).map((c, n) => (
            <li key={c.id} className={ROW}>
              <Dot live={online.includes(c)} delay={n * 0.4} />
              <span className="flex-1 truncate text-fg">{c.name}</span>
              <span className="font-mono text-xs text-fg-muted">{c.ipv4}</span>
            </li>
          ))}
        </ul>
      )}
      <TileActions>
        <SmallButton onClick={() => { if (conn) pick(conn.id); navigate('/vpn') }}>{w.manage}</SmallButton>
      </TileActions>
    </Tile>
  )
}
