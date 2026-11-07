import { ipcMain } from 'electron'
import type { CustomCommand } from '@shared/types'
import { checkCommand, listCommands, pathPrograms, removeCommand, saveCommand } from '../services/docs/docCommands'

/** v3.5 lot 5: the commands added to the Docs page */
export function registerDocsHandlers(): void {
  ipcMain.handle('docs:list', () => listCommands())
  ipcMain.handle('docs:save', (_e, c: Partial<CustomCommand>) => saveCommand(c))
  ipcMain.handle('docs:remove', (_e, id: string) => removeCommand(String(id)))
  ipcMain.handle('docs:check', (_e, cmd: string) => checkCommand(String(cmd ?? '')))
  ipcMain.handle('docs:programs', () => pathPrograms())
}
