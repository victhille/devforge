import type { BrowserWindow } from 'electron'
import { registerSshHandlers } from './ssh'
import { registerSystemHandlers } from './system'
import { registerWindowHandlers } from './window'
import { registerProjectHandlers } from './projects'
import { registerSettingsHandlers } from './settings'
import { registerGitHandlers } from './git'
import { registerCleanerHandlers } from './cleaner'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  registerSshHandlers(mainWindow)
  registerSystemHandlers(mainWindow)
  registerWindowHandlers(mainWindow)
  registerProjectHandlers(mainWindow)
  registerSettingsHandlers()
  registerGitHandlers()
  registerCleanerHandlers()
}
