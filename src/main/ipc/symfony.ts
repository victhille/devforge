import { ipcMain, type BrowserWindow } from 'electron'
import type { SfApiConfig, SfCommand, SfEntityDraft } from '@shared/types'
import {
  apiConfig, applyApi, inspect, routes, run, serverUrl, useConnection, writeEntity, writeFixtures
} from '../services/symfony/symfonyService'

const str = (v: unknown) => typeof v === 'string' ? v : ''

export function registerSymfonyHandlers(mainWindow: BrowserWindow): void {
  const onLog = (log: unknown) => mainWindow.webContents.send('task-log', log)
  const onResult = (result: unknown) => mainWindow.webContents.send('task-result', result)

  ipcMain.handle('symfony:inspect', (_e, p: unknown) => inspect(str(p)))
  ipcMain.handle('symfony:routes', (_e, p: unknown) => routes(str(p)))
  ipcMain.handle('symfony:run', (_e, p: unknown, c: unknown, arg: unknown) => run(str(p), str(c) as SfCommand, str(arg), onLog, onResult))
  ipcMain.handle('symfony:write-entity', (_e, p: unknown, draft: SfEntityDraft) => writeEntity(str(p), draft))
  ipcMain.handle('symfony:api-config', (_e, p: unknown) => apiConfig(str(p)))
  ipcMain.handle('symfony:apply-api', (_e, p: unknown, config: SfApiConfig) => applyApi(str(p), config))
  ipcMain.handle('symfony:write-fixtures', (_e, p: unknown, counts: Record<string, number>) => writeFixtures(str(p), counts ?? {}, onLog, onResult))
  ipcMain.handle('symfony:use-connection', (_e, p: unknown, id: unknown) => useConnection(str(p), str(id)))
  ipcMain.handle('symfony:server-url', (_e, p: unknown) => serverUrl(str(p)))
}
