import { ipcMain, type BrowserWindow } from 'electron'
import type { PackageUpdate } from '@shared/types'
import { loadProjects } from '../services/projects/projectStorage'
import { audit, latestVersions, listManifests, manifestDir, managerOf, update } from '../services/packages/npmPackages'

/** The project's folder, from its id: the window never names a path outside a project */
function rootOf(projectId: unknown): string {
  const p = loadProjects().find(x => x.id === projectId)
  if (!p) throw new Error('Unknown project')
  return p.path
}

const updatesOf = (v: unknown): PackageUpdate[] => (Array.isArray(v) ? v : []).flatMap(u =>
  u && typeof u.name === 'string' && (u.target === 'compatible' || u.target === 'latest') ? [{ name: u.name, dev: !!u.dev, target: u.target }] : [])

export function registerPackagesHandlers(mainWindow: BrowserWindow): void {
  ipcMain.handle('packages:list', (_e, projectId: unknown) => listManifests(rootOf(projectId)))
  ipcMain.handle('packages:latest', (_e, projectId: unknown, dir: unknown, names: unknown) =>
    latestVersions(manifestDir(rootOf(projectId), String(dir ?? '')), Array.isArray(names) ? names.map(String) : []))
  ipcMain.handle('packages:audit', (_e, projectId: unknown, dir: unknown) => {
    const root = rootOf(projectId)
    const full = manifestDir(root, String(dir ?? ''))
    return audit(root, full, managerOf(full, root))
  })
  ipcMain.handle('packages:update', (_e, projectId: unknown, dir: unknown, updates: unknown) => {
    const root = rootOf(projectId)
    const full = manifestDir(root, String(dir ?? ''))
    return update(root, full, managerOf(full, root), updatesOf(updates), line => {
      if (!mainWindow.isDestroyed()) mainWindow.webContents.send('packages:log', line)
    })
  })
}
