import { useCallback, useEffect, useState } from 'react'
import type { HistorySeries, VpsStatus, WatchConfig } from '@shared/types'
import { visibleInterval } from '@renderer/lib/visibleInterval'

/** Watched servers, live from the main process (one sample a minute) */
export function useWatch(): { statuses: VpsStatus[]; config: WatchConfig | null; saveConfig: (c: Partial<WatchConfig>) => Promise<void> } {
  const [statuses, setStatuses] = useState<VpsStatus[]>([])
  const [config, setConfig] = useState<WatchConfig | null>(null)
  useEffect(() => {
    window.devforge.watch.status().then(setStatuses).catch(() => {})
    window.devforge.watch.config().then(setConfig).catch(() => {})
    return window.devforge.watch.onStatus(setStatuses)
  }, [])
  const saveConfig = useCallback(async (c: Partial<WatchConfig>) => { setConfig(await window.devforge.watch.saveConfig(c)) }, [])
  return { statuses, config, saveConfig }
}

/** A history series, reloaded every few minutes while shown (the window too) */
export function useHistory(key: string | null, hours = 24, bucketMin = 15): HistorySeries | null {
  const [series, setSeries] = useState<HistorySeries | null>(null)
  useEffect(() => {
    if (!key) { setSeries(null); return }
    let alive = true
    const load = () => window.devforge.watch.history(key, hours, bucketMin).then(s => { if (alive) setSeries(s) }).catch(() => {})
    load()
    const stop = visibleInterval(load, 2 * 60_000)
    return () => { alive = false; stop() }
  }, [key, hours, bucketMin])
  return series
}
