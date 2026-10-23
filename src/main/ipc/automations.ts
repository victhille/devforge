import { ipcMain } from 'electron'
import { openAutomations, readFeed } from '../services/automations/automationsService'

export function registerAutomationsHandlers(): void {
  ipcMain.handle('automations:feed', () => readFeed())
  ipcMain.handle('automations:open', () => openAutomations())
}
