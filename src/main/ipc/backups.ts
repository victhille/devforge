import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import type { BackupPlan } from '@shared/types'
import { candidates, copyLatest, disable, localFolder, restore, runNow, save, state } from '../services/backups/backupsService'

export function registerBackupsHandlers(mainWindow: BrowserWindow): void {
  const id = (v: unknown) => { if (typeof v !== 'string' || !v) throw new Error('Unknown server'); return v }
  const send = (connectionId: string) => (text: string) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('backups:log', { connectionId, text }) }

  ipcMain.handle('backups:candidates', (_e, c: unknown) => candidates(id(c)))
  ipcMain.handle('backups:state', (_e, c: unknown) => state(id(c)))
  ipcMain.handle('backups:save', (_e, plan: Omit<BackupPlan, 'savedAt'>) => save({ ...plan, connectionId: id(plan?.connectionId) }, send(id(plan?.connectionId))))
  ipcMain.handle('backups:disable', (_e, c: unknown) => disable(id(c), send(id(c))))
  ipcMain.handle('backups:run-now', (_e, c: unknown) => runNow(id(c), send(id(c))))
  ipcMain.handle('backups:copy-now', (_e, c: unknown) => copyLatest(id(c)))
  ipcMain.handle('backups:restore', (_e, c: unknown, path: unknown) => restore(id(c), String(path ?? ''), send(id(c))))
  ipcMain.handle('backups:choose-dir', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], defaultPath: join(app.getPath('documents'), 'DevForge') })
    return r.canceled ? null : r.filePaths[0] ?? null
  })
  ipcMain.handle('backups:open-dir', async (_e, c: unknown) => { const dir = localFolder(id(c)); if (dir) await shell.openPath(dir) })
}
