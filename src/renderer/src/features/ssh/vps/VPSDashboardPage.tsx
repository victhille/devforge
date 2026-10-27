import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Wifi, WifiOff, Cpu, MemoryStick, HardDrive, Clock, RotateCcw } from 'lucide-react'
import type { SSHConnection } from '@shared/types'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { useVPS } from '../VPSContext'
import { fmtBytes, fmtUptime } from './stats'
import { useVpsStats } from './useVpsStats'
import StatCard, { CardLabel } from './components/StatCard'
import { DisksPanel, DockerPanel, ProcessesPanel } from './components/Panels'
import { HealthCard } from '@renderer/features/vps/HealthPage'
import { useI18n } from '@renderer/i18n/I18nContext'

function CenterState({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center text-fg-secondary">{children}</div>
}

export default function VPSDashboardPage() {
  const { connectionId } = useParams<{ connectionId: string }>()
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const v = t.vpsDash
  const { sessions, getOrConnect, reconnect } = useVPS()
  const [connection, setConnection] = useState<SSHConnection | null>(null)

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

  function handleReconnect() {
    if (!connectionId) return
    reset()
    reconnect(connectionId).catch(() => {})
  }

  const memPct  = stats && stats.memory.total > 0 ? (stats.memory.used / stats.memory.total) * 100 : 0
  const swapPct = stats && stats.swap.total > 0 ? (stats.swap.used / stats.swap.total) * 100 : 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line-subtle bg-surface px-5 py-3">
        <IconButton title={v.back} onClick={() => navigate('/ssh')}><ArrowLeft size={14} /></IconButton>
        <span className="shrink-0">
          {status === 'connecting' && <Spinner />}
          {status === 'connected' && <Wifi size={13} className="text-success" />}
          {lost && <WifiOff size={13} className="text-danger" />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-md font-semibold text-fg">{connection?.name ?? '…'}</span>
          <span className="truncate font-mono text-xs text-fg-muted">
            {connection?.username}@{connection?.host}
            {sysInfo && ` · ${sysInfo.os} · ${sysInfo.hostname}`}
          </span>
        </div>
        {lastUpdated && <span className="text-xs text-fg-muted">{lastUpdated.toLocaleTimeString(lang)}</span>}
        {lost && <IconButton title={v.reconnect} onClick={handleReconnect}><RotateCcw size={13} /></IconButton>}
        <IconButton title={v.refresh} onClick={refreshNow} disabled={refreshing || status !== 'connected'}>
          <RefreshCw size={13} className={cn(refreshing && 'animate-spin')} />
        </IconButton>
      </header>

      {lost && (
        <CenterState>
          <WifiOff size={32} className="text-danger" />
          <p className="text-md font-medium text-fg">{v.lost}</p>
          {session?.error && <span className="max-w-md text-sm text-fg-muted">{session.error}</span>}
          <Button variant="secondary" onClick={handleReconnect}><RotateCcw size={13} /> {v.reconnect}</Button>
        </CenterState>
      )}

      {status === 'connecting' && (
        <CenterState>
          <Spinner className="size-7" />
          <p>{v.connecting.replace('{host}', connection?.host ?? '')}</p>
        </CenterState>
      )}

      {status === 'connected' && !stats && (
        <CenterState>
          <Spinner className="size-5" />
          <p>{v.loading}</p>
        </CenterState>
      )}

      {status === 'connected' && stats && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <StatCard
              icon={<Cpu size={14} />} label="CPU" pct={stats.cpu}
              detail={v.load.replace('{v}', stats.load.map(l => l.toFixed(2)).join(' · '))}
              history={cpuHistory}
            />
            <StatCard
              icon={<MemoryStick size={14} />} label={v.memory} pct={memPct}
              detail={`${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}`}
              extra={v.available.replace('{v}', fmtBytes(stats.memory.available))}
            />
            {stats.swap.total > 0 && (
              <StatCard
                icon={<HardDrive size={14} />} label="Swap" pct={swapPct}
                detail={`${fmtBytes(stats.swap.used)} / ${fmtBytes(stats.swap.total)}`}
              />
            )}
            <Card className="flex flex-col gap-2.5 p-4">
              <CardLabel icon={<Clock size={14} />}>{v.uptime}</CardLabel>
              <span className="text-2xl font-semibold text-fg">{fmtUptime(stats.uptime, v.dayShort)}</span>
              {sysInfo && <span className="font-mono text-xs text-fg-muted">{sysInfo.kernel}</span>}
            </Card>
          </div>

          {connectionId && <HealthCard connectionId={connectionId} onOpen={() => {
            try { localStorage.setItem('devforge:vps-server', connectionId) } catch { /* not kept */ }
            navigate('/health')
          }} />}

          <div className="grid grid-cols-[1fr_2fr] gap-4">
            <DisksPanel disks={stats.disks} />
            <ProcessesPanel procs={stats.procs} />
          </div>

          {stats.docker.length > 0 && <DockerPanel containers={stats.docker} />}
        </div>
      )}
    </div>
  )
}
