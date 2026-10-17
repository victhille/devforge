import { ipcMain, app } from 'electron'
import { loadSettings, saveSettings } from '../services/settings/settingsService'
import type { AppSettings } from '@shared/types'

export function registerSettingsHandlers(): void {
  ipcMain.handle('get-settings', async () => loadSettings())

  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    saveSettings(settings)
    app.setLoginItemSettings({
      openAtLogin: settings.startWithWindows,
      openAsHidden: settings.minimizeToTray
    })
  })
}
