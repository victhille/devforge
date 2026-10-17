import { ipcMain, type BrowserWindow } from 'electron'
import { closeTail, openTail, setLogCallback } from '../services/logs/logTail'

export function registerLogHandlers(mainWindow: BrowserWindow): void {
  setLogCallback(e => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('logs:lines', e) })
  ipcMain.handle('logs:open',  (_e, path: string) => openTail(path))
  ipcMain.handle('logs:close', (_e, id: string) => closeTail(id))
}
