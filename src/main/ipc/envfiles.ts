import { ipcMain } from 'electron'
import { readAllRequirements } from '../services/versions/projectVersions'
import { backupEnv, envBackupInfo, readEnvProject, restoreEnv, writeEnvValues } from '../services/envfiles/envFiles'
import { applyEnv, diffEnv } from '../services/envfiles/envSync'

export function registerEnvHandlers(): void {
  ipcMain.handle('env:read',        (_e, projectPath: string) => readEnvProject(projectPath))
  ipcMain.handle('env:write',       (_e, projectPath: string, fileName: string, changes: Record<string, string | null>) =>
    writeEnvValues(projectPath, fileName, changes))
  ipcMain.handle('env:backup',      (_e, projectPath: string) => backupEnv(projectPath))
  ipcMain.handle('env:backup-info', (_e, projectPath: string) => envBackupInfo(projectPath))
  ipcMain.handle('env:restore',     (_e, projectPath: string) => restoreEnv(projectPath))
  ipcMain.handle('env:sync-diff',   (_e, targetId: string, local: string, remote: string) => diffEnv(String(targetId), String(local), String(remote)))
  ipcMain.handle('env:sync-apply',  (_e, targetId: string, local: string, remote: string, direction: 'push' | 'pull', keys: unknown) =>
    applyEnv(String(targetId), String(local), String(remote), direction, Array.isArray(keys) ? keys.map(String) : []))
  ipcMain.handle('versions:requirements', (_e, paths: string[]) => readAllRequirements(paths))
}
