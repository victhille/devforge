import { ipcMain } from 'electron'
import type { ModelKind } from '@shared/types'
import { createModel, listModels, projectDatabase, projectEngine, readModel, removeModel, renameModel, saveModel, writeSql } from '../services/modeling/models'
import { applyScript, doctrineMigration } from '../services/modeling/linked'

/** v3.9: the project's models, in its conception/ folder */
export function registerModelingHandlers(): void {
  ipcMain.handle('modeling:list', (_e, projectPath: unknown) => listModels(String(projectPath ?? '')))
  ipcMain.handle('modeling:read', (_e, projectPath: unknown, file: unknown) => readModel(String(projectPath ?? ''), String(file ?? '')))
  ipcMain.handle('modeling:create', (_e, projectPath: unknown, kind: unknown, name: unknown) => createModel(String(projectPath ?? ''), String(kind ?? '') as ModelKind, String(name ?? '')))
  ipcMain.handle('modeling:save', (_e, projectPath: unknown, file: unknown, model: unknown) => saveModel(String(projectPath ?? ''), String(file ?? ''), model))
  ipcMain.handle('modeling:rename', (_e, projectPath: unknown, file: unknown, name: unknown) => renameModel(String(projectPath ?? ''), String(file ?? ''), String(name ?? '')))
  ipcMain.handle('modeling:remove', (_e, projectPath: unknown, file: unknown) => removeModel(String(projectPath ?? ''), String(file ?? '')))
  ipcMain.handle('modeling:engine', (_e, projectPath: unknown) => projectEngine(String(projectPath ?? '')))
  ipcMain.handle('modeling:project-db', (_e, projectPath: unknown) => projectDatabase(String(projectPath ?? '')))
  ipcMain.handle('modeling:apply', (_e, connectionId: unknown, statements: unknown) =>
    applyScript(String(connectionId ?? ''), Array.isArray(statements) ? statements.map(String) : []))
  ipcMain.handle('modeling:doctrine', (_e, projectPath: unknown, statements: unknown, description: unknown) =>
    doctrineMigration(String(projectPath ?? ''), Array.isArray(statements) ? statements.map(String) : [], String(description ?? '')))
  ipcMain.handle('modeling:write-sql', (_e, projectPath: unknown, file: unknown, sql: unknown) => writeSql(String(projectPath ?? ''), String(file ?? ''), String(sql ?? '')))
}
