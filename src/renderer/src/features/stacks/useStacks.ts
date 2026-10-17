import { useCallback, useEffect, useState } from 'react'
import type { ProcessInfo, ProcessLog, Stack } from '@shared/types'

export const procKey = (stackId: string, stepId: string) => `${stackId}:${stepId}`

/** Saved stacks + live status of their processes. */
export function useStacks() {
  const [stacks, setStacks] = useState<Stack[]>([])
  const [procs, setProcs] = useState<Record<string, ProcessInfo>>({})

  const reload = useCallback(() => window.devforge.stacks.list().then(setStacks), [])

  useEffect(() => {
    reload()
    window.devforge.stacks.processes().then(list => setProcs(Object.fromEntries(list.map(p => [p.key, p]))))
    return window.devforge.stacks.onStatus(info => setProcs(prev => ({ ...prev, [info.key]: info })))
  }, [reload])

  const save = useCallback(async (stack: Stack) => {
    await window.devforge.stacks.save(stack)
    await reload()
  }, [reload])

  const remove = useCallback(async (id: string) => {
    await window.devforge.stacks.remove(id)
    await reload()
  }, [reload])

  const running = (stack: Stack) => stack.steps.filter(s => procs[procKey(stack.id, s.id)]?.status === 'running').length

  return { stacks, procs, save, remove, running }
}

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
