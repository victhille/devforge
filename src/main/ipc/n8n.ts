import { BrowserWindow, ipcMain } from 'electron'
import type { N8nExposure } from '@shared/types'
import {
  checkDomain, control, executions, openTunnel, exportWorkflow, forgetInstance, install, listInstances, logs, precheck, saveApiKey, setActive, status, update, workflows
} from '../services/n8n/n8nService'

export function registerN8nHandlers(mainWindow: BrowserWindow): void {
  const send = (connectionId: string) => (text: string) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('n8n:log', { connectionId, text }) }
  const id = (v: unknown) => { if (typeof v !== 'string' || !v) throw new Error('Unknown server'); return v }

  ipcMain.handle('n8n:instances', () => listInstances())
  ipcMain.handle('n8n:precheck', (_e, c: unknown) => precheck(id(c)))
  ipcMain.handle('n8n:install', (_e, c: unknown, opts: { domain: string; exposure: N8nExposure; email: string }) => install(id(c), opts ?? { domain: '', exposure: 'local', email: '' }, send(id(c))))
  ipcMain.handle('n8n:status', (_e, c: unknown) => status(id(c)))
  ipcMain.handle('n8n:check-domain', (_e, c: unknown, domain: unknown) => checkDomain(id(c), String(domain ?? '').trim().toLowerCase()))
  ipcMain.handle('n8n:open-tunnel', (_e, c: unknown) => openTunnel(id(c)))
  ipcMain.handle('n8n:logs', (_e, c: unknown, lines: number) => logs(id(c), Number(lines)))
  ipcMain.handle('n8n:update', (_e, c: unknown) => update(id(c), send(id(c))))
  ipcMain.handle('n8n:control', (_e, c: unknown, action: 'start' | 'stop' | 'restart') => control(id(c), action))
  ipcMain.handle('n8n:save-key', (_e, c: unknown, key: unknown) => saveApiKey(id(c), typeof key === 'string' ? key : null))
  ipcMain.handle('n8n:forget', (_e, c: unknown) => forgetInstance(id(c)))
  ipcMain.handle('n8n:workflows', (_e, c: unknown) => workflows(id(c)))
  ipcMain.handle('n8n:executions', (_e, c: unknown, onlyErrors: unknown) => executions(id(c), onlyErrors === true))
  ipcMain.handle('n8n:set-active', (_e, c: unknown, wf: unknown, active: unknown) => setActive(id(c), String(wf), active === true))
  ipcMain.handle('n8n:export', (_e, c: unknown, wf: unknown, projectId: unknown) => exportWorkflow(id(c), String(wf), String(projectId)))
}
