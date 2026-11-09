import { useState, useEffect, type ReactNode } from 'react'
import { CardSkeleton, Skeleton } from '@renderer/components/ui/Skeleton'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, WifiOff, RotateCcw, Terminal, ArrowUpCircle } from 'lucide-react'
import type { SSHConnection, VpsHealth } from '@shared/types'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { useVPS } from '../VPSContext'
import { fmtBytes, fmtUptime } from './stats'
import { useVpsStats } from './useVpsStats'
import StatCard from './components/StatCard'
import { DisksPanel, DockerPanel, ProcessesPanel } from './components/Panels'
import { HealthCard } from '@renderer/features/vps/HealthPage'
import { useI18n } from '@renderer/i18n/I18nContext'

function CenterState({ children }: { children: ReactNode }) {
  return <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-fg-secondary">{children}</div>
}

/** The server pages the mock-up's shortcuts lead to */
const SHORTCUTS = [
  { to: '/services', key: 'services' },
  { to: '/backups', key: 'backups' },
  { to: '/deploy', key: 'deploy' },
  { to: '/vpn', key: 'vpn' }
] as const

/**
 * A server's dashboard, as in the mock-up: its state and system in the header,
 * four meters (CPU with its history, memory, disk, uptime), its containers on
 * the left, its health, shortcuts and disks on the right, its processes below.
 */
export default function VPSDashboardPage() {
  const { connectionId } = useParams<{ connectionId: string }>()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const v = t.vpsDash
  const { sessions, getOrConnect, reconnect } = useVPS()
  const [connection, setConnection] = useState<SSHConnection | null>(null)
  const [health, setHealth] = useState<VpsHealth | null>(null)

  const session   = sessions.get(connectionId ?? '')
  const status    = session?.status ?? 'connecting'
  const sessionId = status === 'connected' ? session!.sessionId : null
  const lost      = status === 'error' || status === 'disconnected'

  const { sysInfo, stats, cpuHistory, lastUpdated, refreshing, refreshNow, reset } = useVpsStats(sessionId)

  // Load connection config, then connect (the context keeps the session alive)
  useEffect(() => {
    if (!connectionId) return
    window.devforge.getSshConnections().then(conns => {
      const conn = conns.find(c => c.id === connectionId)
      if (!conn) { navigate('/ssh'); return }
      setConnection(conn)
      getOrConnect(connectionId).catch(() => {})
    })
  }, [connectionId, getOrConnect, navigate])

  // Its health: the alert on the right and the Update button
  useEffect(() => {
    if (!connectionId) return
    setHealth(null)
    window.devforge.vpsOps.health(connectionId).then(setHealth).catch(() => {})
  }, [connectionId])

  function handleReconnect() {
    if (!connectionId) return
    reset()
    reconnect(connectionId).catch(() => {})
  }

  // The Health page opens on this server
  const pickServer = () => { try { if (connectionId) localStorage.setItem('devforge:vps-server', connectionId) } catch { /* not kept */ } }

  const memPct  = stats && stats.memory.total > 0 ? (stats.memory.used / stats.memory.total) * 100 : 0
  const swapPct = stats && stats.swap.total > 0 ? (stats.swap.used / stats.swap.total) * 100 : 0
  const root    = stats?.disks.find(d => d.mount === '/') ?? stats?.disks[0]
  const updates = health?.checks.find(c => c.id === 'updates' && (c.level === 'warn' || c.level === 'bad'))
  const pending = Number(updates?.values.count ?? 0)
  const upShort = stats ? fmtUptime(stats.uptime, v.dayShort).split(' ')[0] : ''

  const state = status === 'connected'
    ? <Badge dot color="success">{stats ? v.online.replace('{up}', upShort) : v.connected}</Badge>
    : lost ? <Badge dot color="danger">{v.lost}</Badge>
    : <Badge dot color="warning">{t.ssh.connecting}</Badge>

  return (
    <Page className="df-mockup">
      <PageHeader
        crumb={<nav aria-label={t.nav.breadcrumb} className="flex min-w-0 items-center gap-1.5"><Link to="/ssh" className="hover:text-fg">{t.nav.ssh}</Link><span aria-hidden>/</span><span className="truncate">{connection?.name ?? '…'}</span></nav>}
        title={<span className="flex min-w-0 items-center gap-3"><span className="truncate">{connection?.name ?? '…'}</span>{state}</span>}
        subtitle={
          <span className="block truncate font-mono text-sm text-fg-secondary">
            {[connection?.host, sysInfo?.os, sysInfo?.hostname].filter(Boolean).join(' · ')}
          </span>
        }
        actions={<>
          {lastUpdated && <span className="text-xs text-fg-muted">{lastUpdated.toLocaleTimeString(lang)}</span>}
          {lost && <IconButton title={v.reconnect} onClick={handleReconnect}><RotateCcw size={14} /></IconButton>}
          <IconButton title={v.refresh} onClick={refreshNow} disabled={refreshing || status !== 'connected'}>
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
          </IconButton>
          <Button variant="secondary" onClick={() => navigate(`/ssh?connect=${connectionId}`)}><Terminal size={14} aria-hidden /> {v.terminal}</Button>
          {pending > 0 && <Button onClick={() => { pickServer(); navigate('/health') }}><ArrowUpCircle size={14} aria-hidden /> {v.updateN.replace('{n}', String(pending))}</Button>}
        </>}
      />

      {lost && (
        <CenterState>
          <WifiOff size={32} className="text-danger" />
          <p className="text-md font-medium text-fg">{v.lost}</p>
          {session?.error && <span className="max-w-md text-sm text-fg-muted">{session.error}</span>}
          <Button variant="secondary" onClick={handleReconnect}><RotateCcw size={14} /> {v.reconnect}</Button>
        </CenterState>
      )}

      {status === 'connecting' && (
        <CenterState>
          <Spinner className="size-7" />
          <p>{v.connecting.replace('{host}', connection?.host ?? '')}</p>
        </CenterState>
      )}

      {status === 'connected' && !stats && (
        <div role="status" aria-label={v.loading} className="flex flex-col gap-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3.5">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}</div>
          <CardSkeleton label={false} rows={3} />
        </div>
      )}

      {status === 'connected' && stats && (
        <>
          {/* The four meters of the mock-up */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="CPU" pct={stats.cpu} detail={v.load.replace('{v}', stats.load.map(l => l.toFixed(2)).join(' · '))} history={cpuHistory} />
            <StatCard label={v.memory} pct={memPct}
              value={`${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}`}
              detail={v.memDetail.replace('{pct}', String(Math.round(memPct))).replace('{swap}', String(Math.round(swapPct)))} />
            {root && (
              <StatCard label={v.disk} pct={root.pct}
                value={`${fmtBytes(root.used)} / ${fmtBytes(root.total)}`}
                detail={v.diskFree.replace('{pct}', String(root.pct)).replace('{free}', fmtBytes(root.avail))} />
            )}
            <Card className="flex flex-col gap-2.5 p-3.5">
              <span className="text-sm text-fg-muted">{v.uptime}</span>
              <span className="font-display text-2xl leading-tight font-bold tracking-[-.02em] text-fg">{fmtUptime(stats.uptime, v.dayShort)}</span>
              {sysInfo && <span className="truncate font-mono text-xs text-fg-muted">{sysInfo.kernel}</span>}
            </Card>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-5 xl:col-span-7">
              <DockerPanel containers={stats.docker} />
            </div>
            <div className="flex min-w-0 flex-col gap-5 xl:col-span-5">
              {connectionId && <HealthCard health={health} onOpen={pickServer} />}
              <Card className="flex flex-col gap-3.5 p-4">
                <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{v.shortcuts}</h2>
                <div className="grid grid-cols-2 gap-2">
                  {SHORTCUTS.map(s => (
                    <Button key={s.to} size="sm" variant="secondary" onClick={() => { pickServer(); navigate(s.to) }}>{t.nav[s.key]}</Button>
                  ))}
                </div>
              </Card>
              <DisksPanel disks={stats.disks} />
            </div>
          </div>

          <ProcessesPanel procs={stats.procs} />
        </>
      )}
    </Page>
  )
}
