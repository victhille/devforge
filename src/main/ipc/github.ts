import { ipcMain } from 'electron'
import { hasToken, repoOf, rerunFailed, saveToken, status } from '../services/github/githubService'

export function registerGithubHandlers(): void {
  ipcMain.handle('github:repo', (_e, p: unknown) => repoOf(String(p ?? '')))
  ipcMain.handle('github:status', (_e, p: unknown) => status(String(p ?? '')))
  ipcMain.handle('github:rerun', (_e, p: unknown, runId: unknown) => rerunFailed(String(p ?? ''), Number(runId)))
  ipcMain.handle('github:save-token', (_e, token: unknown) => saveToken(typeof token === 'string' ? token : null))
  ipcMain.handle('github:has-token', () => hasToken())
}
