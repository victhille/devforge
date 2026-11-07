import { dialog, ipcMain, type BrowserWindow } from 'electron'
import { closeTail, openTail, rememberLogFile, setLogCallback } from '../services/logs/logTail'

export function registerLogHandlers(mainWindow: BrowserWindow): void {
  setLogCallback(e => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('logs:lines', e) })
  ipcMain.handle('logs:open',  (_e, path: string) => openTail(path))
  ipcMain.handle('logs:close', (_e, id: string) => closeTail(id))
  // A file outside the projects: only one the user picks here
  ipcMain.handle('logs:pick', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'showHiddenFiles'] })
    const path = r.canceled ? null : r.filePaths[0] ?? null
    if (path) rememberLogFile(path)
    return path
  })
}
