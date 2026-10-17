import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Wifi, WifiOff, Loader,
  Cpu, MemoryStick, HardDrive, Clock, Activity, Box, RotateCcw
} from 'lucide-react'
import type { SSHConnection } from '@shared/types'
import { useVPS } from './VPSContext'
import styles from './VPSDashboardPage.module.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SysInfo {
  hostname: string
  kernel:   string
  os:       string
}

interface VPSStats {
  cpu:    number
  load:   [number, number, number]
  uptime: number
  memory: { total: number; used: number; available: number }
  swap:   { total: number; used: number }
  disks:  Array<{ device: string; mount: string; total: number; used: number; avail: number; pct: number }>
  procs:  Array<{ user: string; pid: number; cpu: number; mem: number; cmd: string }>
  docker: Array<{ name: string; image: string; status: string }>
}

// ─── SSH Commands ─────────────────────────────────────────────────────────────

const CMD_SYSINFO = [
  'hostname',
  'uname -r',
  "cat /etc/os-release 2>/dev/null | grep '^PRETTY_NAME' | cut -d'\"' -f2 || echo Linux"
].join(' && echo "§§§" && ')

const CMD_MEM    = "cat /proc/meminfo | grep -E '^(MemTotal|MemFree|MemAvailable|Buffers|Cached|SwapTotal|SwapFree):'"
const CMD_UPTIME = 'cat /proc/uptime && echo "§§§" && cat /proc/loadavg'
const CMD_DISK   = "df -B1 2>/dev/null | grep '^/dev/' | awk '{print $1\"\\t\"$2\"\\t\"$3\"\\t\"$4\"\\t\"$5\"\\t\"$6}'"
const CMD_PROCS  = "ps aux --sort=-%cpu 2>/dev/null | awk 'NR>1 && NR<=11 {cmd=$11; for(i=12;i<=NF;i++) cmd=cmd\" \"$i; print $1\"\\t\"$2\"\\t\"$3\"\\t\"$4\"\\t\"cmd}'"
const CMD_DOCKER = "docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null || echo ''"
const CMD_CPU    = 'vmstat 1 2 2>/dev/null | tail -1 || echo "0 0 0 0 0 0 0 0 0 0 0 0 0 0 100 0 0"'

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseSysInfo(raw: string): SysInfo {
  const parts = raw.split('§§§').map(s => s.trim())
  return { hostname: parts[0] ?? '', kernel: parts[1] ?? '', os: parts[2] ?? 'Linux' }
}

function parseStats(mem: string, uptime: string, disk: string, procs: string, docker: string, cpu: string): VPSStats {
  const memMap: Record<string, number> = {}
  for (const line of mem.split('\n').filter(Boolean)) {
    const m = line.match(/^(\w+):\s+(\d+)/)
    if (m) memMap[m[1]] = parseInt(m[2]) * 1024
  }

  const upParts   = uptime.split('§§§')
  const uptimeSec = parseFloat(upParts[0]?.trim().split(' ')[0] ?? '0')
  const loadParts = upParts[1]?.trim().split(' ') ?? []
  const load: [number, number, number] = [
    parseFloat(loadParts[0] ?? '0'),
    parseFloat(loadParts[1] ?? '0'),
    parseFloat(loadParts[2] ?? '0'),
  ]

  const cpuFields = cpu.split(/\s+/).filter(Boolean)
  const cpuIdle   = parseFloat(cpuFields[14] ?? '100')
  const cpuPct    = Math.max(0, Math.min(100, 100 - cpuIdle))

  const disks = disk.split('\n').filter(Boolean).map(line => {
    const p = line.split('\t')
    return {
      device: p[0] ?? '', total: parseInt(p[1] ?? '0') || 0,
      used:   parseInt(p[2] ?? '0') || 0, avail: parseInt(p[3] ?? '0') || 0,
      pct:    parseInt((p[4] ?? '0%').replace('%', '')) || 0, mount: p[5] ?? '',
    }
  }).filter(d => d.total > 0)

  const procList = procs.split('\n').filter(Boolean).map(line => {
    const p = line.split('\t')
    return {
      user: p[0] ?? '', pid: parseInt(p[1] ?? '0'),
      cpu:  parseFloat(p[2] ?? '0'), mem: parseFloat(p[3] ?? '0'),
      cmd:  (p[4] ?? '').split('/').pop()?.split(' ')[0] ?? p[4] ?? '',
    }
  })

  const dockerList = docker.split('\n').filter(l => l && l.includes('|')).map(line => {
    const [name, image, status] = line.split('|')
    return { name: name ?? '', image: image ?? '', status: status ?? '' }
  })

  return {
    cpu: cpuPct, load, uptime: uptimeSec,
    memory: { total: memMap.MemTotal ?? 0, used: (memMap.MemTotal ?? 0) - (memMap.MemAvailable ?? 0), available: memMap.MemAvailable ?? 0 },
    swap:   { total: memMap.SwapTotal ?? 0, used: (memMap.SwapTotal ?? 0) - (memMap.SwapFree ?? 0) },
    disks, procs: procList, docker: dockerList,
  }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}j ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function usageColor(pct: number): string {
  if (pct < 60) return '#22C55E'
  if (pct < 80) return '#F59E0B'
  return '#EF4444'
}

function dockerStatusColor(status: string): string {
  if (status.toLowerCase().startsWith('up')) return '#22C55E'
  if (status.toLowerCase().includes('exit')) return '#EF4444'
  return '#F59E0B'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, pct, detail, extra, history }: {
  icon: React.ReactNode; label: string; pct: number; detail: string; extra?: string; history?: number[]
}) {
  const color = usageColor(pct)
  return (
    <div className={styles.statCard}>
      <div className={styles.statCardHeader}>
        <span className={styles.statIcon}>{icon}</span>
        <span className={styles.statLabel}>{label}</span>
        <span className={styles.statPct} style={{ color }}>{Math.round(pct)}%</span>
      </div>
      {history && history.length > 1 && <Sparkline data={history} color={color} />}
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className={styles.statDetail}>{detail}</span>
      {extra && <span className={styles.statExtra}>{extra}</span>}
    </div>
  )
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 180, H = 32
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - (Math.min(100, Math.max(0, v)) / 100) * (H - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  return (
    <svg className={styles.sparkline} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function DiskBar({ disk }: { disk: VPSStats['disks'][0] }) {
  const color = usageColor(disk.pct)
  return (
    <div className={styles.diskRow}>
      <div className={styles.diskMeta}>
        <span className={styles.diskMount}>{disk.mount}</span>
        <span className={styles.diskPct} style={{ color }}>{disk.pct}%</span>
      </div>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${disk.pct}%`, background: color }} />
      </div>
      <span className={styles.diskDetail}>{fmtBytes(disk.used)} / {fmtBytes(disk.total)}</span>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function VPSDashboardPage() {
  const { connectionId }              = useParams<{ connectionId: string }>()
  const navigate                      = useNavigate()
  const { sessions, getOrConnect, reconnect } = useVPS()

  const session    = sessions.get(connectionId ?? '')
  const connStatus = session?.status ?? 'connecting'
  const sessionId  = session?.status === 'connected' ? session.sessionId : null

  const [connection,  setConnection]  = useState<SSHConnection | null>(null)
  const [sysInfo,     setSysInfo]     = useState<SysInfo | null>(null)
  const [stats,       setStats]       = useState<VPSStats | null>(null)
  const [cpuHistory,  setCpuHistory]  = useState<number[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const isMountedRef                  = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Load connection config + trigger connect (context keeps it alive)
  useEffect(() => {
    if (!connectionId) return
    window.devforge.getSshConnections().then(conns => {
      const conn = conns.find(c => c.id === connectionId)
      if (!conn) { navigate('/ssh'); return }
      setConnection(conn)
      getOrConnect(connectionId).catch(() => {})
    })
  }, [connectionId])

  // Fetch sysInfo once on first connection
  useEffect(() => {
    if (!sessionId || sysInfo) return
    window.devforge.sshExec(sessionId, CMD_SYSINFO)
      .then(raw => { if (isMountedRef.current) setSysInfo(parseSysInfo(raw)) })
      .catch(() => {})
  }, [sessionId])

  // Auto-refresh stats every 10s when connected
  useEffect(() => {
    if (!sessionId) return
    doRefresh(sessionId)
    const interval = setInterval(() => doRefresh(sessionId), 10_000)
    return () => clearInterval(interval)
  }, [sessionId])

  const doRefresh = useCallback(async (sid: string) => {
    if (!isMountedRef.current) return
    setRefreshing(true)
    try {
      const [memOut, uptimeOut, diskOut, procsOut, dockerOut, cpuOut] = await Promise.all([
        window.devforge.sshExec(sid, CMD_MEM),
        window.devforge.sshExec(sid, CMD_UPTIME),
        window.devforge.sshExec(sid, CMD_DISK),
        window.devforge.sshExec(sid, CMD_PROCS),
        window.devforge.sshExec(sid, CMD_DOCKER),
        window.devforge.sshExec(sid, CMD_CPU),
      ])
      if (!isMountedRef.current) return
      const parsed = parseStats(memOut, uptimeOut, diskOut, procsOut, dockerOut, cpuOut)
      setStats(parsed)
      setCpuHistory(prev => [...prev.slice(-29), parsed.cpu])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Stats fetch error:', err)
    } finally {
      if (isMountedRef.current) setRefreshing(false)
    }
  }, [])

  function handleRefresh() {
    if (sessionId && !refreshing) doRefresh(sessionId)
  }

  function handleReconnect() {
    if (connectionId) {
      setStats(null)
      setSysInfo(null)
      setCpuHistory([])
      reconnect(connectionId).catch(() => {})
    }
  }

  const memPct  = stats ? (stats.memory.used / stats.memory.total) * 100 : 0
  const swapPct = stats && stats.swap.total > 0 ? (stats.swap.used / stats.swap.total) * 100 : 0

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/ssh')}><ArrowLeft size={14} /></button>
        <div className={styles.headerStatus}>
          {connStatus === 'connecting'   && <Loader  size={13} className={styles.spin} />}
          {connStatus === 'connected'    && <Wifi    size={13} style={{ color: '#22C55E' }} />}
          {(connStatus === 'error' || connStatus === 'disconnected') && <WifiOff size={13} style={{ color: '#EF4444' }} />}
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.headerName}>{connection?.name ?? '…'}</span>
          <span className={styles.headerSub}>
            {connection?.username}@{connection?.host}
            {sysInfo && ` · ${sysInfo.os} · ${sysInfo.hostname}`}
          </span>
        </div>
        <div className={styles.headerRight}>
          {lastUpdated && <span className={styles.lastUpdated}>{lastUpdated.toLocaleTimeString()}</span>}
          {(connStatus === 'error' || connStatus === 'disconnected') && (
            <button className={styles.refreshBtn} onClick={handleReconnect} title="Reconnecter">
              <RotateCcw size={13} />
            </button>
          )}
          <button
            className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ''}`}
            onClick={handleRefresh}
            disabled={refreshing || connStatus !== 'connected'}
            title="Actualiser"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Error / disconnected */}
      {(connStatus === 'error' || connStatus === 'disconnected') && (
        <div className={styles.errorState}>
          <WifiOff size={32} />
          <p>Connexion perdue</p>
          <span>{session?.error}</span>
          <button className={styles.reconnectBtn} onClick={handleReconnect}>
            <RotateCcw size={13} /> Reconnecter
          </button>
        </div>
      )}

      {/* Connecting */}
      {connStatus === 'connecting' && (
        <div className={styles.loadingState}>
          <Loader size={28} className={styles.spin} />
          <p>Connexion à {connection?.host}…</p>
        </div>
      )}

      {/* Loading first stats */}
      {connStatus === 'connected' && !stats && (
        <div className={styles.loadingState}>
          <Loader size={20} className={styles.spin} />
          <p>Chargement des statistiques…</p>
        </div>
      )}

      {/* Dashboard */}
      {connStatus === 'connected' && stats && (
        <div className={styles.content}>
          {/* Stat cards */}
          <div className={styles.statsRow}>
            <StatCard
              icon={<Cpu size={14} />} label="CPU" pct={stats.cpu}
              detail={`Load : ${stats.load[0].toFixed(2)} · ${stats.load[1].toFixed(2)} · ${stats.load[2].toFixed(2)}`}
              history={cpuHistory}
            />
            <StatCard
              icon={<MemoryStick size={14} />} label="Mémoire" pct={memPct}
              detail={`${fmtBytes(stats.memory.used)} / ${fmtBytes(stats.memory.total)}`}
              extra={`Disponible : ${fmtBytes(stats.memory.available)}`}
            />
            {stats.swap.total > 0 && (
              <StatCard
                icon={<HardDrive size={14} />} label="Swap" pct={swapPct}
                detail={`${fmtBytes(stats.swap.used)} / ${fmtBytes(stats.swap.total)}`}
              />
            )}
            <div className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <span className={styles.statIcon}><Clock size={14} /></span>
                <span className={styles.statLabel}>Uptime</span>
              </div>
              <div className={styles.uptimeValue}>{fmtUptime(stats.uptime)}</div>
              {sysInfo && <span className={styles.statDetail}>{sysInfo.kernel}</span>}
            </div>
          </div>

          {/* Disks + Processes */}
          <div className={styles.midRow}>
            <div className={styles.card}>
              <div className={styles.cardHeader}><HardDrive size={13} /><span>Disques</span></div>
              <div className={styles.diskList}>
                {stats.disks.map(d => <DiskBar key={d.device + d.mount} disk={d} />)}
                {stats.disks.length === 0 && <span className={styles.empty}>Aucun disque détecté</span>}
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}><Activity size={13} /><span>Processus (top CPU)</span></div>
              <table className={styles.procTable}>
                <thead><tr><th>Utilisateur</th><th>PID</th><th>CPU%</th><th>MEM%</th><th>Commande</th></tr></thead>
                <tbody>
                  {stats.procs.map((p, i) => (
                    <tr key={i}>
                      <td className={styles.procUser}>{p.user}</td>
                      <td className={styles.procMono}>{p.pid}</td>
                      <td style={{ color: usageColor(p.cpu * 5) }}>{p.cpu.toFixed(1)}</td>
                      <td>{p.mem.toFixed(1)}</td>
                      <td className={`${styles.procMono} ${styles.procCmd}`}>{p.cmd}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Docker */}
          {stats.docker.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHeader}><Box size={13} /><span>Docker ({stats.docker.length} conteneur{stats.docker.length > 1 ? 's' : ''})</span></div>
              <div className={styles.dockerGrid}>
                {stats.docker.map(c => (
                  <div key={c.name} className={styles.dockerCard}>
                    <div className={styles.dockerStatus}>
                      <span className={styles.dockerDot} style={{ background: dockerStatusColor(c.status) }} />
                      <span className={styles.dockerName}>{c.name}</span>
                    </div>
                    <span className={styles.dockerImage}>{c.image}</span>
                    <span className={styles.dockerStatusText}>{c.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
