import { ipcMain, type BrowserWindow } from 'electron'
import type { Stack } from '@shared/types'
import { processManager } from '../services/stacks/processManager'
import { loadStacks, removeStack, saveStack, startStack, startStep, stopStack, stopStep } from '../services/stacks/stackService'

export function registerStackHandlers(mainWindow: BrowserWindow): void {
  processManager.setCallbacks(
    log  => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('stacks:log', log) },
    info => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('stacks:status', info) }
  )

  ipcMain.handle('stacks:list',       () => loadStacks())
  ipcMain.handle('stacks:save',       (_e, stack: Stack) => saveStack(stack))
  ipcMain.handle('stacks:remove',     (_e, id: string) => removeStack(id))
  ipcMain.handle('stacks:start',      (_e, id: string) => startStack(id))
  ipcMain.handle('stacks:stop',       (_e, id: string) => stopStack(id))
  ipcMain.handle('stacks:start-step', (_e, stackId: string, stepId: string) => startStep(stackId, stepId))
  ipcMain.handle('stacks:stop-step',  (_e, stackId: string, stepId: string) => stopStep(stackId, stepId))
  ipcMain.handle('stacks:processes',  () => processManager.list())
  ipcMain.handle('stacks:logs',       (_e, key: string) => processManager.logs(key))
}
