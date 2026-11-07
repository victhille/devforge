import { ipcMain } from 'electron'
import { account, buildLogs, deployments, domains, envDiff, projectInfo, promote, redeploy, saveToken } from '../services/vercel/vercelService'

export function registerVercelHandlers(): void {
  const s = (v: unknown) => String(v ?? '')
  ipcMain.handle('vercel:account', () => account())
  ipcMain.handle('vercel:save-token', (_e, token: unknown) => saveToken(typeof token === 'string' ? token : null))
  ipcMain.handle('vercel:project', (_e, p: unknown) => projectInfo(s(p)))
  ipcMain.handle('vercel:deployments', (_e, p: unknown) => deployments(s(p)))
  ipcMain.handle('vercel:build-logs', (_e, p: unknown, d: unknown) => buildLogs(s(p), s(d)))
  ipcMain.handle('vercel:redeploy', (_e, p: unknown, d: unknown) => redeploy(s(p), s(d)))
  ipcMain.handle('vercel:promote', (_e, p: unknown, d: unknown) => promote(s(p), s(d)))
  ipcMain.handle('vercel:env', (_e, p: unknown) => envDiff(s(p)))
  ipcMain.handle('vercel:domains', (_e, p: unknown) => domains(s(p)))
}
