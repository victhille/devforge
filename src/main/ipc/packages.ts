import { ipcMain, type BrowserWindow } from 'electron'
import type { ManifestFile, PackageUpdate } from '@shared/types'
import { loadProjects } from '../services/projects/projectStorage'
import { auditFor, latestFor, projectManifests, updateFor } from '../services/packages/projectPackages'

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

  ipcMain.handle('packages:list', (_e, projectId: unknown) => projectManifests(rootOf(projectId)))
  ipcMain.handle('packages:latest', (_e, projectId: unknown, dir: unknown, file: unknown, names: unknown) =>
    latestFor(rootOf(projectId), String(dir ?? ''), fileOf(file), Array.isArray(names) ? names.map(String) : []))
  ipcMain.handle('packages:audit', (_e, projectId: unknown, dir: unknown, file: unknown) =>
    auditFor(rootOf(projectId), String(dir ?? ''), fileOf(file)))
  ipcMain.handle('packages:update', async (_e, projectId: unknown, dir: unknown, file: unknown, updates: unknown) => {
    // The backup's place stays in the main process
    const { ok, restored } = await updateFor(rootOf(projectId), String(dir ?? ''), fileOf(file), updatesOf(updates), log)
    return { ok, restored }
  })
}
