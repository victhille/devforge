import { useEffect, useState } from 'react'
import type { ProcessLog } from '@shared/types'

const MAX_LINES = 1000

/** Live log lines of one process (history + stream). */
export function useProcessLogs(key: string | null) {
  const [logs, setLogs] = useState<ProcessLog[]>([])

  useEffect(() => {
    if (!key) { setLogs([]); return }
    let active = true
    window.devforge.stacks.logs(key).then(l => { if (active) setLogs(l) })
    const off = window.devforge.stacks.onLog(log => {
      if (log.key !== key) return
      setLogs(prev => (prev.length >= MAX_LINES ? [...prev.slice(-MAX_LINES + 1), log] : [...prev, log]))
    })
    return () => { active = false; off() }
  }, [key])

  return logs
}
