import { ipcMain } from 'electron'
import { getRepoDetails, gitFetch, gitPull, gitPush } from '../services/git/gitRepo'

export function registerGitHandlers(): void {
  ipcMain.handle('git:details', (_e, path: string) => getRepoDetails(path))
  ipcMain.handle('git:fetch',   (_e, path: string) => gitFetch(path))
  ipcMain.handle('git:pull',    (_e, path: string) => gitPull(path))
  ipcMain.handle('git:push',    (_e, path: string) => gitPush(path))
}
