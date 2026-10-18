import { ipcMain } from 'electron'
import type { ComposeAction, ComposeTarget, ContainerAction } from '@shared/types'
import {
  composeAction, containerAction, followComposeLogs, followLogs, getOverview, prune, stopComposeLogs, stopLogs
} from '../services/docker/dockerService'

export function registerDockerHandlers(): void {
  ipcMain.handle('docker:overview',    () => getOverview())
  ipcMain.handle('docker:container',   (_e, id: string, action: ContainerAction) => containerAction(id, action))
  ipcMain.handle('docker:compose',     (_e, target: ComposeTarget, action: ComposeAction) => composeAction(target, action))
  ipcMain.handle('docker:compose-logs',      (_e, target: ComposeTarget) => followComposeLogs(target))
  ipcMain.handle('docker:stop-compose-logs', (_e, name: string) => stopComposeLogs(name))
  ipcMain.handle('docker:prune',       () => prune())
  ipcMain.handle('docker:follow-logs', (_e, id: string) => followLogs(id))
  ipcMain.handle('docker:stop-logs',   (_e, id: string) => stopLogs(id))
}
