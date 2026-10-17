import { ipcMain } from 'electron'
import type { ContainerAction } from '@shared/types'
import { composeAction, containerAction, followLogs, getOverview, prune, stopLogs } from '../services/docker/dockerService'

export function registerDockerHandlers(): void {
  ipcMain.handle('docker:overview',    () => getOverview())
  ipcMain.handle('docker:container',   (_e, id: string, action: ContainerAction) => containerAction(id, action))
  ipcMain.handle('docker:compose',     (_e, name: string, files: string, action: 'up' | 'down' | 'restart') => composeAction(name, files, action))
  ipcMain.handle('docker:prune',       () => prune())
  ipcMain.handle('docker:follow-logs', (_e, id: string) => followLogs(id))
  ipcMain.handle('docker:stop-logs',   (_e, id: string) => stopLogs(id))
}
