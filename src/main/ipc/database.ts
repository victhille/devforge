import { ipcMain, type BrowserWindow } from 'electron'
import type { RowChange } from '@shared/lib/rowEdits'
import type { DbBrowseOptions, DbConnection, DbTableRef, ExportFormat } from '@shared/types'
import { exportTable, importCsv, pickCsv, saveImage, saveResult } from '../services/database/dbTransfer'
import { closeDb, dbBrowse, dbDetails, dbDiagram, dbOverview, dbQuery, dbSchema, testDb, dbApplyRows } from '../services/database/dbClient'
import { listDbConnections, removeDbConnection, saveDbConnection } from '../services/database/dbStorage'
import { addDetected, detectLocal, detectRemote } from '../services/database/dbDetect'

const FORMATS: ExportFormat[] = ['csv', 'json', 'sql', 'sql-create']

export function registerDatabaseHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('db:list',   () => listDbConnections())
  ipcMain.handle('db:save',   async (_e, c: DbConnection) => { saveDbConnection(c); await closeDb(c.id) })
  ipcMain.handle('db:remove', async (_e, id: string) => { await closeDb(id); removeDbConnection(id) })
  ipcMain.handle('db:test',   (_e, c: DbConnection) => testDb(c))
  ipcMain.handle('db:schema', (_e, id: string) => dbSchema(id))
  ipcMain.handle('db:query',  (_e, id: string, sql: string) => dbQuery(id, sql))
  ipcMain.handle('db:overview', (_e, id: string) => dbOverview(id))
  ipcMain.handle('db:details',  (_e, id: string, t: DbTableRef) => dbDetails(id, t))
  ipcMain.handle('db:diagram',  (_e, id: string) => dbDiagram(id))
  ipcMain.handle('db:save-image', (_e, name: string, content: string, ext: string) => saveImage(mainWindow, String(name ?? ''), String(content ?? ''), ext === 'png' ? 'png' : 'svg'))
  ipcMain.handle('db:apply-rows', (_e, id: string, t: DbTableRef, changes: RowChange[]) => dbApplyRows(id, t, Array.isArray(changes) ? changes : []))
  ipcMain.handle('db:export', (_e, id: string, t: DbTableRef, format: ExportFormat) => exportTable(mainWindow, id, t, FORMATS.includes(format) ? format : 'csv'))
  ipcMain.handle('db:save-result', (_e, name: string, content: string, ext: string) => saveResult(mainWindow, String(name ?? ''), String(content ?? ''), ext === 'json' ? 'json' : 'csv'))
  ipcMain.handle('db:pick-csv', (_e, id: string, t: DbTableRef) => pickCsv(mainWindow, id, t))
  ipcMain.handle('db:import-csv', (_e, id: string, t: DbTableRef, token: string, mapping: unknown, emptyIsNull: boolean) =>
    importCsv(id, t, String(token ?? ''), Array.isArray(mapping) ? mapping.map(m => (typeof m === 'string' ? m : null)) : [], emptyIsNull !== false))
  ipcMain.handle('db:browse',   (_e, id: string, t: DbTableRef, o: DbBrowseOptions) => dbBrowse(id, t, o))
  ipcMain.handle('db:detect-remote', (_e, sshId: string) => detectRemote(sshId))
  ipcMain.handle('db:detect-local',  () => detectLocal())
  ipcMain.handle('db:add-detected',  (_e, key: string) => addDetected(key))
}
