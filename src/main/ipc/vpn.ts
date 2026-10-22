import { BrowserWindow, ipcMain } from 'electron'
import { clients, create, detect, forget, listServers, openWeb, qrcode, remove, saveConfig, saveLogin, setEnabled } from '../services/vpn/vpnService'

export function registerVpnHandlers(mainWindow: BrowserWindow): void {
  const id = (v: unknown) => { if (typeof v !== 'string' || !v) throw new Error('Unknown server'); return v }

  ipcMain.handle('vpn:servers', () => listServers())
  ipcMain.handle('vpn:detect', (_e, c: unknown) => detect(id(c)))
  ipcMain.handle('vpn:save-login', (_e, c: unknown, port: unknown, user: unknown, pass: unknown) => saveLogin(id(c), Number(port), String(user ?? ''), String(pass ?? '')))
  ipcMain.handle('vpn:forget', (_e, c: unknown) => forget(id(c)))
  ipcMain.handle('vpn:clients', (_e, c: unknown) => clients(id(c)))
  ipcMain.handle('vpn:create', (_e, c: unknown, name: unknown, expiresAt: unknown) => create(id(c), String(name ?? ''), typeof expiresAt === 'string' ? expiresAt : null))
  ipcMain.handle('vpn:remove', (_e, c: unknown, client: unknown) => remove(id(c), Number(client)))
  ipcMain.handle('vpn:set-enabled', (_e, c: unknown, client: unknown, enabled: unknown) => setEnabled(id(c), Number(client), enabled === true))
  ipcMain.handle('vpn:qrcode', (_e, c: unknown, client: unknown) => qrcode(id(c), Number(client)))
  ipcMain.handle('vpn:save-config', (_e, c: unknown, client: unknown) => saveConfig(id(c), Number(client), mainWindow.isDestroyed() ? null : mainWindow))
  ipcMain.handle('vpn:open-web', (_e, c: unknown) => openWeb(id(c)))
}
