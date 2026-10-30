import { ipcMain } from 'electron'
import type { ModelKind } from '@shared/types'
import { createModel, listModels, readModel, removeModel, renameModel, saveModel } from '../services/modeling/models'

/** v3.9: the project's models, in its conception/ folder */
export function registerModelingHandlers(): void {
  ipcMain.handle('modeling:list', (_e, projectPath: unknown) => listModels(String(projectPath ?? '')))
  ipcMain.handle('modeling:read', (_e, projectPath: unknown, file: unknown) => readModel(String(projectPath ?? ''), String(file ?? '')))
  ipcMain.handle('modeling:create', (_e, projectPath: unknown, kind: unknown, name: unknown) => createModel(String(projectPath ?? ''), String(kind ?? '') as ModelKind, String(name ?? '')))
  ipcMain.handle('modeling:save', (_e, projectPath: unknown, file: unknown, model: unknown) => saveModel(String(projectPath ?? ''), String(file ?? ''), model))
  ipcMain.handle('modeling:rename', (_e, projectPath: unknown, file: unknown, name: unknown) => renameModel(String(projectPath ?? ''), String(file ?? ''), String(name ?? '')))
  ipcMain.handle('modeling:remove', (_e, projectPath: unknown, file: unknown) => removeModel(String(projectPath ?? ''), String(file ?? '')))
}
