import { ipcMain, type BrowserWindow } from 'electron'
import type { Monitor } from '@shared/types'
import { check, listMonitors, listStates, removeMonitor, saveMonitor, startMonitors } from '../services/monitor/urlMonitor'

export function registerMonitorHandlers(mainWindow: BrowserWindow): void {
  startMonitors(s => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('monitor:state', s) })
  ipcMain.handle('monitor:list',   () => listMonitors())
  ipcMain.handle('monitor:states', () => listStates())
  ipcMain.handle('monitor:save',   (_e, m: Monitor) => saveMonitor(m))
  ipcMain.handle('monitor:remove', (_e, id: string) => removeMonitor(id))
  ipcMain.handle('monitor:check',  (_e, id: string) => check(id))
}
