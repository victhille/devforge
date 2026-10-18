import { ipcMain } from 'electron'
import type { DbBrowseOptions, DbConnection, DbTableRef } from '@shared/types'
import { closeDb, dbBrowse, dbDetails, dbOverview, dbQuery, dbSchema, testDb } from '../services/database/dbClient'
import { listDbConnections, removeDbConnection, saveDbConnection } from '../services/database/dbStorage'
import { addDetected, detectLocal, detectRemote } from '../services/database/dbDetect'

export function registerDatabaseHandlers(): void {
  ipcMain.handle('db:list',   () => listDbConnections())
  ipcMain.handle('db:save',   async (_e, c: DbConnection) => { saveDbConnection(c); await closeDb(c.id) })
  ipcMain.handle('db:remove', async (_e, id: string) => { await closeDb(id); removeDbConnection(id) })
  ipcMain.handle('db:test',   (_e, c: DbConnection) => testDb(c))
  ipcMain.handle('db:schema', (_e, id: string) => dbSchema(id))
  ipcMain.handle('db:query',  (_e, id: string, sql: string) => dbQuery(id, sql))
  ipcMain.handle('db:overview', (_e, id: string) => dbOverview(id))
  ipcMain.handle('db:details',  (_e, id: string, t: DbTableRef) => dbDetails(id, t))
  ipcMain.handle('db:browse',   (_e, id: string, t: DbTableRef, o: DbBrowseOptions) => dbBrowse(id, t, o))
  ipcMain.handle('db:detect-remote', (_e, sshId: string) => detectRemote(sshId))
  ipcMain.handle('db:detect-local',  () => detectLocal())
  ipcMain.handle('db:add-detected',  (_e, key: string) => addDetected(key))
}
