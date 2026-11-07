import { app } from 'electron'
import type { AppSettings } from '@shared/types'

/** Started by Windows at login with "minimize to tray": stay in the tray */
export const startedHidden = process.argv.includes('--hidden')

export function applyLoginItem(settings: AppSettings): void {
  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    args: settings.minimizeToTray ? ['--hidden'] : []
  })
}
