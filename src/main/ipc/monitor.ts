import { BrowserWindow, ipcMain } from 'electron'
import type { Monitor, RemoteCompose, WatchConfig } from '@shared/types'
import { check, listMonitors, listStates, removeMonitor, saveMonitor, startMonitors } from '../services/monitor/urlMonitor'
import { readSeries, startHistoryFlush } from '../services/monitor/history'
import { remoteDocker, remoteDockerAction, remoteDockerLogs, saveWatchConfig, startWatch, vpsStatuses, watchConfig } from '../services/monitor/vpsWatch'

/** Every window (app, desktop widget) gets the watch's news */
const broadcast = (channel: string, payload: unknown) => {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload)
}

export function registerMonitorHandlers(mainWindow: BrowserWindow): void {
  startMonitors(s => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('monitor:state', s) })
  startHistoryFlush()
  startWatch(s => broadcast('watch:status', s), a => broadcast('watch:alert', a))

  ipcMain.handle('monitor:list',   () => listMonitors())
  ipcMain.handle('monitor:states', () => listStates())
  ipcMain.handle('monitor:save',   (_e, m: Monitor) => saveMonitor(m))
  ipcMain.handle('monitor:remove', (_e, id: string) => removeMonitor(id))
  ipcMain.handle('monitor:check',  (_e, id: string) => check(id))

  // ─── Background watch ────────────────────────────────────────────────────────
  ipcMain.handle('watch:status',      () => vpsStatuses())
  ipcMain.handle('watch:config',      () => watchConfig())
  ipcMain.handle('watch:save-config', (_e, c: Partial<WatchConfig>) => saveWatchConfig(c ?? {}))
  ipcMain.handle('watch:history', (_e, key: string, hours: number, bucketMin: number) => {
    if (!/^(vps|site):[\w-]+$/.test(String(key))) throw new Error('Invalid series')
    const h = Math.min(168, Math.max(1, Number(hours) || 24))
    const b = Math.min(240, Math.max(1, Number(bucketMin) || 15))
    return readSeries(String(key), Date.now() - h * 3600_000, b * 60_000)
  })
  ipcMain.handle('watch:docker',        (_e, id: string) => remoteDocker(String(id)))
  ipcMain.handle('watch:docker-action', (_e, id: string, target: { container?: string; compose?: RemoteCompose }, action: 'start' | 'stop' | 'restart' | 'up') =>
    remoteDockerAction(String(id), target ?? {}, action))
  ipcMain.handle('watch:docker-logs',   (_e, id: string, container: string, lines: number) => remoteDockerLogs(String(id), String(container), Number(lines)))
}
