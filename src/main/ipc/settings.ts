import { ipcMain } from 'electron'
import { loadSettings, saveSettings } from '../services/settings/settingsService'
import { applyLoginItem } from '../lib/loginItem'
import { checkForUpdates, getUpdateStatus, installUpdate, setUpdateChannel } from '../services/updates/updater'
import type { AppSettings } from '@shared/types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('get-settings', async () => loadSettings())

  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    saveSettings(settings)
    applyLoginItem(settings)
    setUpdateChannel(settings.updateChannel === 'beta')
  })

  // ─── Updates ─────────────────────────────────────────────────────────────────
  ipcMain.handle('update:status', () => getUpdateStatus())
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => installUpdate())
}
