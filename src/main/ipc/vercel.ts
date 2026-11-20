import { ipcMain } from 'electron'
import { account, buildLogs, deployments, domains, envDiff, projectInfo, promote, redeploy, saveToken } from '../services/vercel/vercelService'
import {
  accountBuildLogs,
  accountDeployments,
  accountDomains,
  accountProjects,
  cancelDeployment,
  linkProject,
  promoteIn,
  scopes
} from '../services/vercel/vercelAccount'

export function registerVercelHandlers(): void {
  const s = (v: unknown) => String(v ?? '')
  // null = the personal account; anything else must be a team id (checked by the service)
  const sc = (v: unknown) => (v === null || v === undefined ? null : String(v))
  ipcMain.handle('vercel:account', () => account())
  ipcMain.handle('vercel:save-token', (_e, token: unknown) => saveToken(typeof token === 'string' ? token : null))
  ipcMain.handle('vercel:project', (_e, p: unknown) => projectInfo(s(p)))
  ipcMain.handle('vercel:deployments', (_e, p: unknown) => deployments(s(p)))
  ipcMain.handle('vercel:build-logs', (_e, p: unknown, d: unknown) => buildLogs(s(p), s(d)))
  ipcMain.handle('vercel:redeploy', (_e, p: unknown, d: unknown) => redeploy(s(p), s(d)))
  ipcMain.handle('vercel:promote', (_e, p: unknown, d: unknown) => promote(s(p), s(d)))
  ipcMain.handle('vercel:env', (_e, p: unknown) => envDiff(s(p)))
  ipcMain.handle('vercel:domains', (_e, p: unknown) => domains(s(p)))
  // The account page
  ipcMain.handle('vercel:scopes', () => scopes())
  ipcMain.handle('vercel:account-projects', (_e, scope: unknown) => accountProjects(sc(scope)))
  ipcMain.handle('vercel:account-deployments', (_e, scope: unknown) => accountDeployments(sc(scope)))
  ipcMain.handle('vercel:account-domains', (_e, scope: unknown) => accountDomains(sc(scope)))
  ipcMain.handle('vercel:account-build-logs', (_e, scope: unknown, d: unknown) => accountBuildLogs(sc(scope), s(d)))
  ipcMain.handle('vercel:cancel', (_e, scope: unknown, d: unknown) => cancelDeployment(sc(scope), s(d)))
  ipcMain.handle('vercel:promote-in', (_e, scope: unknown, p: unknown, d: unknown) => promoteIn(sc(scope), s(p), s(d)))
  ipcMain.handle('vercel:link', (_e, local: unknown, scope: unknown, p: unknown) => linkProject(s(local), sc(scope), s(p)))
}
