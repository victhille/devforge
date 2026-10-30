import { BrowserWindow, ipcMain } from 'electron'
import type { HealthFixId } from '@shared/types'
import { listServices, openService } from '../services/vps/vpsServices'
import { fixCommand, readHealth, runFix } from '../services/vps/vpsHealth'
import { loadSettings } from '../services/settings/settingsService'

const OFFLINE = /ENETUNREACH|EHOSTUNREACH|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|Timed out while waiting for handshake/

/**
 * A server out of reach (no network, server off) is an answer, not a bug: it
 * goes back to the page as `{ offline }`, which the preload turns into the
 * error the page shows, without Electron printing a stack in the console.
 */
async function quiet<T>(work: Promise<T>): Promise<T | { offline: string }> {
  try { return await work } catch (err) {
    const text = String((err as { code?: string })?.code ?? '') + ' ' + String(err instanceof Error ? err.message : err)
    if (!OFFLINE.test(text)) throw err
    const where = /\d+\.\d+\.\d+\.\d+(:\d+)?|\[[^\]]+\](:\d+)?/.exec(text)?.[0] ?? ''
    const fr = loadSettings().language === 'fr'
    return { offline: fr ? `Serveur injoignable${where ? ` (${where})` : ''} : pas de réseau vers lui, ou il est éteint.` : `Server out of reach${where ? ` (${where})` : ''}: no network to it, or it is off.` }
  }
}

export function registerVpsOpsHandlers(mainWindow: BrowserWindow): void {
  const id = (v: unknown) => { if (typeof v !== 'string' || !v) throw new Error('Unknown server'); return v }
  const send = (connectionId: string) => (text: string) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('vps:fix-log', { connectionId, text }) }

  ipcMain.handle('vps:services', (_e, c: unknown) => quiet(listServices(id(c))))
  ipcMain.handle('vps:open-service', (_e, c: unknown, port: unknown, scheme: unknown) => openService(id(c), Number(port), scheme === 'https' ? 'https' : 'http'))
  ipcMain.handle('vps:health', (_e, c: unknown) => quiet(readHealth(id(c))))
  ipcMain.handle('vps:fix-command', (_e, _c: unknown, fix: unknown) => fixCommand(fix as HealthFixId))
  ipcMain.handle('vps:run-fix', (_e, c: unknown, fix: unknown) => runFix(id(c), fix as HealthFixId, send(id(c))))
}
