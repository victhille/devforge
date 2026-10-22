import { BrowserWindow, ipcMain } from 'electron'
import type { HealthFixId } from '@shared/types'
import { listServices, openService } from '../services/vps/vpsServices'
import { fixCommand, readHealth, runFix } from '../services/vps/vpsHealth'

export function registerVpsOpsHandlers(mainWindow: BrowserWindow): void {
  const id = (v: unknown) => { if (typeof v !== 'string' || !v) throw new Error('Unknown server'); return v }
  const send = (connectionId: string) => (text: string) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('vps:fix-log', { connectionId, text }) }

  ipcMain.handle('vps:services', (_e, c: unknown) => listServices(id(c)))
  ipcMain.handle('vps:open-service', (_e, c: unknown, port: unknown, scheme: unknown) => openService(id(c), Number(port), scheme === 'https' ? 'https' : 'http'))
  ipcMain.handle('vps:health', (_e, c: unknown) => readHealth(id(c)))
  ipcMain.handle('vps:fix-command', (_e, _c: unknown, fix: unknown) => fixCommand(fix as HealthFixId))
  ipcMain.handle('vps:run-fix', (_e, c: unknown, fix: unknown) => runFix(id(c), fix as HealthFixId, send(id(c))))
}
