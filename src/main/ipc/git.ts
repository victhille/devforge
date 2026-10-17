import { ipcMain } from 'electron'
import { getChanges, getRepoDetails, gitCommit, gitFetch, gitPull, gitPush } from '../services/git/gitRepo'

export function registerGitHandlers(): void {
  ipcMain.handle('git:details', (_e, path: string) => getRepoDetails(path))
  ipcMain.handle('git:fetch',   (_e, path: string) => gitFetch(path))
  ipcMain.handle('git:pull',    (_e, path: string) => gitPull(path))
  ipcMain.handle('git:push',    (_e, path: string) => gitPush(path))
  ipcMain.handle('git:changes', (_e, path: string) => getChanges(path))
  ipcMain.handle('git:commit',  (_e, path: string, message: string, files: string[]) => gitCommit(path, message, files))
}
