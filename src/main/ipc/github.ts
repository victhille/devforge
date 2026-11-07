import { ipcMain, type BrowserWindow } from 'electron'
import type { CiStates } from '@shared/types'
import { checkCi, ciStates, startCiWatch } from '../services/github/ciWatch'
import { hasToken, repoOf, rerunFailed, saveToken, status } from '../services/github/githubService'

export function registerGithubHandlers(mainWindow: BrowserWindow): void {
  const send = (s: CiStates) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('github:ci-states', s) }
  startCiWatch(mainWindow, send)
  ipcMain.handle('github:ci-states', () => ciStates())
  ipcMain.handle('github:check-ci', () => checkCi(mainWindow, send))
  ipcMain.handle('github:repo', (_e, p: unknown) => repoOf(String(p ?? '')))
  ipcMain.handle('github:status', (_e, p: unknown) => status(String(p ?? '')))
  ipcMain.handle('github:rerun', (_e, p: unknown, runId: unknown) => rerunFailed(String(p ?? ''), Number(runId)))
  ipcMain.handle('github:save-token', (_e, token: unknown) => saveToken(typeof token === 'string' ? token : null))
  ipcMain.handle('github:has-token', () => hasToken())
}
