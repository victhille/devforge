import { ipcMain, type BrowserWindow } from 'electron'
import type { LaravelCommand, SfApiConfig, SfEntityDraft } from '@shared/types'
import { apiConfig, applyApi, inspect, routes, run, writeModel, writeSeed } from '../services/laravel/laravelService'

const str = (v: unknown) => typeof v === 'string' ? v : ''

export function registerLaravelHandlers(mainWindow: BrowserWindow): void {
  const onLog = (log: unknown) => mainWindow.webContents.send('task-log', log)
  const onResult = (result: unknown) => mainWindow.webContents.send('task-result', result)

  ipcMain.handle('laravel:inspect', (_e, p: unknown) => inspect(str(p)))
  ipcMain.handle('laravel:routes', (_e, p: unknown) => routes(str(p)))
  ipcMain.handle('laravel:run', (_e, p: unknown, c: unknown, arg: unknown) => run(str(p), str(c) as LaravelCommand, str(arg), onLog, onResult))
  ipcMain.handle('laravel:write-model', (_e, p: unknown, draft: SfEntityDraft) => writeModel(str(p), draft))
  ipcMain.handle('laravel:api-config', (_e, p: unknown) => apiConfig(str(p)))
  ipcMain.handle('laravel:apply-api', (_e, p: unknown, config: SfApiConfig) => applyApi(str(p), config))
  ipcMain.handle('laravel:write-seed', (_e, p: unknown, counts: Record<string, number>) => writeSeed(str(p), counts ?? {}, onLog, onResult))
}
