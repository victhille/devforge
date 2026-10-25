import { ipcMain, type BrowserWindow } from 'electron'
import type { NextCommand, SfApiConfig, SfEntityDraft } from '@shared/types'
import { apiConfig, applyApi, inspect, routes, run, writeModel, writePrismaClient, writeSeed } from '../services/nextjs/nextService'

const str = (v: unknown) => typeof v === 'string' ? v : ''

export function registerNextjsHandlers(mainWindow: BrowserWindow): void {
  const onLog = (log: unknown) => mainWindow.webContents.send('task-log', log)
  const onResult = (result: unknown) => mainWindow.webContents.send('task-result', result)

  ipcMain.handle('nextjs:inspect', (_e, p: unknown) => inspect(str(p)))
  ipcMain.handle('nextjs:routes', (_e, p: unknown) => routes(str(p)))
  ipcMain.handle('nextjs:run', (_e, p: unknown, c: unknown, arg: unknown) => run(str(p), str(c) as NextCommand, str(arg), onLog, onResult))
  ipcMain.handle('nextjs:write-model', (_e, p: unknown, draft: SfEntityDraft) => writeModel(str(p), draft))
  ipcMain.handle('nextjs:write-client', (_e, p: unknown) => writePrismaClient(str(p)))
  ipcMain.handle('nextjs:api-config', (_e, p: unknown) => apiConfig(str(p)))
  ipcMain.handle('nextjs:apply-api', (_e, p: unknown, config: SfApiConfig) => applyApi(str(p), config))
  ipcMain.handle('nextjs:write-seed', (_e, p: unknown, counts: Record<string, number>) => writeSeed(str(p), counts ?? {}, onLog, onResult))
}
