import { ipcMain, type BrowserWindow } from 'electron'
import type { WebhookResponse } from '@shared/types'
import { clearRequests, listRequests, replay, setResponse, setWebhookCallback, startWebhooks, stopWebhooks, webhookStatus } from '../services/webhooks/webhookServer'

export function registerWebhookHandlers(mainWindow: BrowserWindow): void {
  setWebhookCallback(r => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('webhooks:request', r) })
  ipcMain.handle('webhooks:start',  (_e, port: number) => startWebhooks(port))
  ipcMain.handle('webhooks:stop',   () => stopWebhooks())
  ipcMain.handle('webhooks:status', () => webhookStatus())
  ipcMain.handle('webhooks:list',   () => listRequests())
  ipcMain.handle('webhooks:clear',  () => clearRequests())
  ipcMain.handle('webhooks:set-response', (_e, r: WebhookResponse) => setResponse(r))
  ipcMain.handle('webhooks:replay', (_e, id: string, url: string) => replay(id, url))
}
