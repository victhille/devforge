import { ipcMain } from 'electron'
import { suggestDomains, suggestLogFiles, suggestMonitorUrls } from '../services/suggest/suggestions'

export function registerSuggestHandlers(): void {
  ipcMain.handle('suggest:log-files',    () => suggestLogFiles())
  ipcMain.handle('suggest:monitor-urls', () => suggestMonitorUrls())
  ipcMain.handle('suggest:domains',      () => suggestDomains())
}
