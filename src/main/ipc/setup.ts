import { ipcMain } from 'electron'
import type { SetupDatabase } from '@shared/types'
import { freePort, githubLogin } from '../services/projects/projectSetup'
import { phpEnable, phpStatus } from '../services/projects/phpCheck'

const DATABASES: SetupDatabase[] = ['none', 'postgres', 'mysql', 'sqlite']
const db = (v: unknown): SetupDatabase => DATABASES.includes(v as SetupDatabase) ? v as SetupDatabase : 'none'

export function registerSetupHandlers(): void {
  ipcMain.handle('setup:free-port', (_e, start: unknown) => freePort(Number(start)))
  ipcMain.handle('setup:github-login', () => githubLogin())
  ipcMain.handle('setup:php-status', (_e, database: unknown) => phpStatus(db(database)))
  ipcMain.handle('setup:php-enable', (_e, database: unknown) => phpEnable(db(database)))
}
