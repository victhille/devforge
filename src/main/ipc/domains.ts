import { ipcMain } from 'electron'
import type { LocalDomain } from '@shared/types'
import { applyHosts, domainsStatus, listDomains, removeDomain, saveDomain, startDomains } from '../services/domains/domainService'

export function registerDomainHandlers(): void {
  startDomains().catch(() => {})
  ipcMain.handle('domains:list',   () => listDomains())
  ipcMain.handle('domains:save',   (_e, d: LocalDomain) => saveDomain(d))
  ipcMain.handle('domains:remove', (_e, id: string) => removeDomain(id))
  ipcMain.handle('domains:status', () => domainsStatus())
  ipcMain.handle('domains:apply-hosts', () => applyHosts())
}
