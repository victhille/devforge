import { ipcMain } from 'electron'
import type { ModelKind } from '@shared/types'
import { createModel, listModels, projectDatabase, projectEngine, readModel, removeModel, renameModel, saveModel, writeSql } from '../services/modeling/models'
import { applyScript, doctrineMigration } from '../services/modeling/linked'
import { mcdFromMpdFile, modelFromDatabase } from '../services/modeling/fromDatabase'

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
  // v4.1: each step reported to the window that asked, under its job name
  ipcMain.handle('modeling:from-db', (e, projectPath: unknown, connectionId: unknown, name: unknown, job: unknown) =>
    modelFromDatabase(String(projectPath ?? ''), String(connectionId ?? ''), String(name ?? ''), p => { if (!e.sender.isDestroyed()) e.sender.send('modeling:progress', { ...p, job: String(job ?? '') }) }))
  // v4.2: an MPD drawn by hand gets its MCD
  ipcMain.handle('modeling:mcd-from-mpd', (_e, projectPath: unknown, file: unknown) => mcdFromMpdFile(String(projectPath ?? ''), String(file ?? '')))
  ipcMain.handle('modeling:write-sql', (_e, projectPath: unknown, file: unknown, sql: unknown) => writeSql(String(projectPath ?? ''), String(file ?? ''), String(sql ?? '')))
}
