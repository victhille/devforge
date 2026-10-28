import { ipcMain } from 'electron'
import { getActivity } from '../services/git/activity'
import { getChanges, getFileDiff, getFileStates, getRepoDetails, gitCommit, gitFetch, gitPull, gitPush } from '../services/git/gitRepo'

export function registerGitHandlers(): void {
  ipcMain.handle('git:details', (_e, path: string, fresh?: boolean) => getRepoDetails(path, fresh === true))
  ipcMain.handle('git:fetch',   (_e, path: string) => gitFetch(path))
  ipcMain.handle('git:pull',    (_e, path: string) => gitPull(path))
  ipcMain.handle('git:push',    (_e, path: string) => gitPush(path))
  ipcMain.handle('git:changes', (_e, path: string) => getChanges(path))
  ipcMain.handle('activity:get', (_e, fresh: unknown) => getActivity(fresh === true))
  ipcMain.handle('git:file-states', (_e, path: string) => getFileStates(String(path ?? '')))
  ipcMain.handle('git:file-diff', (_e, path: string, rel: string) => getFileDiff(String(path ?? ''), String(rel ?? '')))
  ipcMain.handle('git:commit',  (_e, path: string, message: string, files: string[]) => gitCommit(path, message, files))
}
