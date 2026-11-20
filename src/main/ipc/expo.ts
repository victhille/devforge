import { ipcMain, type BrowserWindow } from 'electron'
import type { ExpoKey, ExpoStartOptions } from '@shared/types'
import {
  answerNgrok,
  checkVersions,
  expoLogs,
  expoProjects,
  expoStatus,
  fixVersions,
  sendKey,
  setExpoCallbacks,
  startExpo,
  stopExpo
} from '../services/expo/expoService'

export function registerExpoHandlers(mainWindow: BrowserWindow): void {
  setExpoCallbacks(
    l => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('expo:log', l)
    },
    s => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('expo:status', s)
    }
  )
  const s = (v: unknown) => String(v ?? '')
  ipcMain.handle('expo:projects', () => expoProjects())
  ipcMain.handle('expo:status', () => expoStatus())
  ipcMain.handle('expo:logs', () => expoLogs())
  // The options are checked one by one by the service (target, connection, port, clear)
  ipcMain.handle('expo:start', (_e, id: unknown, o: unknown) => startExpo(s(id), (o ?? {}) as ExpoStartOptions))
  ipcMain.handle('expo:stop', () => stopExpo())
  ipcMain.handle('expo:key', (_e, k: unknown) => sendKey(s(k) as ExpoKey))
  ipcMain.handle('expo:install-ngrok', () => answerNgrok())
  ipcMain.handle('expo:check', (_e, id: unknown) => checkVersions(s(id)))
  ipcMain.handle('expo:fix', (_e, id: unknown) => fixVersions(s(id)))
}
