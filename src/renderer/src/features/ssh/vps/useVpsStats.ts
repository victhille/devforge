import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CMD_CPU, CMD_DISK, CMD_DOCKER, CMD_MEM, CMD_PROCS, CMD_SYSINFO, CMD_UPTIME,
  parseStats, parseSysInfo, type SysInfo, type VPSStats
} from './stats'

const REFRESH_MS = 10_000
const HISTORY_LEN = 30

/** Poll system stats over an SSH session every 10s while `sessionId` is set. */
export function useVpsStats(sessionId: string | null) {
  const [sysInfo,     setSysInfo]     = useState<SysInfo | null>(null)
  const [stats,       setStats]       = useState<VPSStats | null>(null)
  const [cpuHistory,  setCpuHistory]  = useState<number[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const refresh = useCallback(async (sid: string) => {
    setRefreshing(true)
    try {
      const outputs = await Promise.all(
        [CMD_MEM, CMD_UPTIME, CMD_DISK, CMD_PROCS, CMD_DOCKER, CMD_CPU].map(cmd => window.devforge.sshExec(sid, cmd))
      )
      if (!mounted.current) return
      const parsed = parseStats(...(outputs as [string, string, string, string, string, string]))
      setStats(parsed)
      setCpuHistory(prev => [...prev.slice(-(HISTORY_LEN - 1)), parsed.cpu])
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Stats fetch error:', err)
    } finally {
      if (mounted.current) setRefreshing(false)
    }
  }, [])

  // System info once per session
  useEffect(() => {
    if (!sessionId) return
    window.devforge.sshExec(sessionId, CMD_SYSINFO)
      .then(raw => { if (mounted.current) setSysInfo(parseSysInfo(raw)) })
      .catch(() => {})
  }, [sessionId])

  // Stats polling
  useEffect(() => {
    if (!sessionId) return
    refresh(sessionId)
    const id = setInterval(() => refresh(sessionId), REFRESH_MS)
    return () => clearInterval(id)
  }, [sessionId, refresh])

  const reset = useCallback(() => {
    setStats(null)
    setSysInfo(null)
    setCpuHistory([])
  }, [])

  return {
    sysInfo, stats, cpuHistory, lastUpdated, refreshing, reset,
    refreshNow: () => { if (sessionId && !refreshing) refresh(sessionId) }
  }
}
