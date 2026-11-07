import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { randomUUID } from 'crypto'
import { createProject } from '../services/projects/projectCreator'
import { groupContents, scanDirectory } from '../services/projects/projectScanner'
import { loadProjects, saveProject, removeProject, updateLastOpened, toggleFavorite } from '../services/projects/projectStorage'
import { commandRunner } from '../services/system/commandRunner'
import { assertSafeDir, assertScriptName } from '../lib/safe'
import type { Project, ProjectCreationOptions, LogLine, CommandResult, PackageManager, LinkKind } from '@shared/types'
import { getActiveProject, getProjectHub, linkResource, setActiveProject } from '../services/projects/projectHub'

export function registerProjectHandlers(mainWindow: BrowserWindow): void {
  // ─── Project hub and active project ─────────────────────────────────────────
  ipcMain.handle('hub:get', (_e, id: string) => getProjectHub(String(id)))
  ipcMain.handle('hub:link', (_e, id: string, kind: LinkKind, ref: string, linked: boolean) => linkResource(String(id), kind, String(ref), linked === true))
  ipcMain.handle('hub:get-active', () => getActiveProject())
  ipcMain.handle('hub:set-active', (_e, id: string | null) => {
    setActiveProject(typeof id === 'string' ? id : null)
    // The app and the desktop widget follow the same project
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('hub:active', getActiveProject())
  })

  // ─── Project Creation ─────────────────────────────────────────────────────────
  ipcMain.handle('create-project', async (_event, options: ProjectCreationOptions): Promise<string> => {
    const taskId = randomUUID()
    try {
      const actualTaskId = createProject(
        options,
        (log: LogLine)          => mainWindow.webContents.send('task-log', log),
        (result: CommandResult) => mainWindow.webContents.send('task-result', result)
      )
      return actualTaskId
    } catch (err: unknown) {
      const errorLog: LogLine = {
        taskId, type: 'error',
        text: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString()
      }
      mainWindow.webContents.send('task-log', errorLog)
      mainWindow.webContents.send('task-result', { taskId, exitCode: 1, status: 'failed' } as CommandResult)
      return taskId
    }
  })

  ipcMain.handle('cancel-task', async (_event, taskId: string) => {
    commandRunner.cancel(taskId)
  })

  // ─── Scripts ─────────────────────────────────────────────────────────────────
  ipcMain.handle('scripts:get', async (_event, projectPath: string) => {
    const pkgPath = join(projectPath, 'package.json')
    if (!existsSync(pkgPath)) return {}
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      return pkg.scripts ?? {}
    } catch { return {} }
  })

  ipcMain.handle('scripts:run', async (_event, projectPath: string, script: string, pm: PackageManager): Promise<string> => {
    // The command goes through a shell: only real scripts of this package.json, with plain names
    assertSafeDir(projectPath)
    assertScriptName(script)
    const pkg = JSON.parse(readFileSync(join(projectPath, 'package.json'), 'utf-8'))
    if (!pkg.scripts || !(script in pkg.scripts)) throw new Error(`Unknown script: ${script}`)
    const pmExe = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm'
    return commandRunner.run({
      executable: pmExe,
      args: ['run', script],
      cwd: projectPath,
      onLog:    (log)    => mainWindow.webContents.send('task-log', log),
      onResult: (result) => mainWindow.webContents.send('task-result', result)
    })
  })

  // A script started before the dependencies are installed fails ('vite' is not recognized…)
  ipcMain.handle('scripts:needs-install', async (_event, projectPath: string): Promise<boolean> => {
    assertSafeDir(projectPath)
    const file = join(projectPath, 'package.json')
    if (!existsSync(file) || existsSync(join(projectPath, 'node_modules'))) return false
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf-8')) as { dependencies?: object; devDependencies?: object }
      return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0
    } catch {
      return false
    }
  })

  ipcMain.handle('scripts:install', async (_event, projectPath: string, pm: PackageManager): Promise<string> => {
    assertSafeDir(projectPath)
    return commandRunner.run({
      executable: pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm',
      args: ['install'],
      cwd: projectPath,
      onLog:    (log)    => mainWindow.webContents.send('task-log', log),
      onResult: (result) => mainWindow.webContents.send('task-result', result)
    })
  })

  // ─── Project Scanner ──────────────────────────────────────────────────────────
  ipcMain.handle('scan-directory', async (_event, directory: string) => scanDirectory(directory))

  // ─── Project Storage ──────────────────────────────────────────────────────────
  // A group's projects are read from disk each time: one added or removed shows at once
  ipcMain.handle('get-projects', async () => Promise.all(loadProjects().map(async p => ({
    ...p, missing: !existsSync(p.path), ...(p.framework === 'group' ? await groupContents(p.path) : {})
  }))))

  ipcMain.handle('save-project', async (_event, project: Project) => {
    saveProject(project)
  })

  ipcMain.handle('remove-project', async (_event, id: string) => {
    removeProject(id)
  })

  ipcMain.handle('update-project-last-opened', async (_event, id: string) => {
    updateLastOpened(id)
  })

  ipcMain.handle('toggle-favorite', async (_event, id: string) => {
    toggleFavorite(id)
  })
}
