import { ipcMain, type BrowserWindow } from 'electron'
import type { ManifestFile, PackageUpdate } from '@shared/types'
import { loadProjects } from '../services/projects/projectStorage'
import { audit, latestVersions, listManifests, manifestDir, managerOf, update } from '../services/packages/npmPackages'
import { composerAudit, composerAvailable, composerLatest, composerUpdate, listComposerManifests } from '../services/packages/composerPackages'

/** The project's folder, from its id: the window never names a path outside a project */
function rootOf(projectId: unknown): string {
  const p = loadProjects().find(x => x.id === projectId)
  if (!p) throw new Error('Unknown project')
  return p.path
}

const fileOf = (v: unknown): ManifestFile => v === 'composer.json' ? 'composer.json' : 'package.json'

const updatesOf = (v: unknown): PackageUpdate[] => (Array.isArray(v) ? v : []).flatMap(u =>
  u && typeof u.name === 'string' && (u.target === 'compatible' || u.target === 'latest') ? [{ name: u.name, dev: !!u.dev, target: u.target }] : [])

export function registerPackagesHandlers(mainWindow: BrowserWindow): void {
  const log = (line: string) => { if (!mainWindow.isDestroyed()) mainWindow.webContents.send('packages:log', line) }

  ipcMain.handle('packages:list', async (_e, projectId: unknown) => {
    const root = rootOf(projectId)
    const composer = await Promise.all(listComposerManifests(root).map(async m => ({ ...m, toolMissing: !(await composerAvailable(manifestDir(root, m.dir, 'composer.json'))) })))
    return [...listManifests(root), ...composer]
  })
  ipcMain.handle('packages:latest', (_e, projectId: unknown, dir: unknown, file: unknown, names: unknown) => {
    const list = Array.isArray(names) ? names.map(String) : []
    const f = fileOf(file)
    const full = manifestDir(rootOf(projectId), String(dir ?? ''), f)
    return f === 'composer.json' ? composerLatest(list) : latestVersions(full, list)
  })
  ipcMain.handle('packages:audit', (_e, projectId: unknown, dir: unknown, file: unknown) => {
    const root = rootOf(projectId)
    const f = fileOf(file)
    const full = manifestDir(root, String(dir ?? ''), f)
    return f === 'composer.json' ? composerAudit(full) : audit(root, full, managerOf(full, root))
  })
  ipcMain.handle('packages:update', (_e, projectId: unknown, dir: unknown, file: unknown, updates: unknown) => {
    const root = rootOf(projectId)
    const f = fileOf(file)
    const full = manifestDir(root, String(dir ?? ''), f)
    return f === 'composer.json' ? composerUpdate(full, updatesOf(updates), log) : update(root, full, managerOf(full, root), updatesOf(updates), log)
  })
}
