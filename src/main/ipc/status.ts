import { ipcMain, type BrowserWindow } from 'electron'
import type { StatusAlerts, StatusConfig, StatusIncident, StatusInstallOptions } from '@shared/types'
import { domainCheck, install, openFirewall, overview, precheck, saveConfig, saveIncidents, testAlert, uninstall } from '../services/status/statusService'

const str = (v: unknown) => typeof v === 'string' ? v : ''

export function registerStatusHandlers(mainWindow: BrowserWindow): void {
  const onLog = (connectionId: string) => (text: string) => mainWindow.webContents.send('status:log', { connectionId, text })
  ipcMain.handle('status:precheck', (_e, id: unknown) => precheck(str(id)))
  ipcMain.handle('status:check-domain', (_e, id: unknown, domain: unknown) => domainCheck(str(id), str(domain)))
  ipcMain.handle('status:install', (_e, id: unknown, opts: StatusInstallOptions) => install(str(id), opts ?? { exposure: 'caddy', domain: '', email: '' }, onLog(str(id))))
  ipcMain.handle('status:overview', (_e, id: unknown) => overview(str(id)))
  ipcMain.handle('status:save-config', (_e, id: unknown, config: StatusConfig) => saveConfig(str(id), config))
  ipcMain.handle('status:save-incidents', (_e, id: unknown, list: StatusIncident[]) => saveIncidents(str(id), Array.isArray(list) ? list : []))
  ipcMain.handle('status:test-alert', (_e, alerts: StatusAlerts) => testAlert(alerts ?? { ntfy: null, webhook: null }))
  ipcMain.handle('status:open-firewall', (_e, id: unknown) => openFirewall(str(id)))
  ipcMain.handle('status:uninstall', (_e, id: unknown) => uninstall(str(id), onLog(str(id))))
}
