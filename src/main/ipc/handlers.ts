import { ipcMain, dialog, shell, BrowserWindow, Notification, app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { randomUUID } from 'crypto'
import { detectEnvironment } from '../services/environmentDetector'
import { createProject } from '../services/projectCreator'
import { commandRunner } from '../services/commandRunner'
import { loadProjects, saveProject, removeProject, updateLastOpened, toggleFavorite } from '../services/projectStorage'
import { loadSettings, saveSettings } from '../services/settingsService'
import { loadSshConnections, saveSshConnection, removeSshConnection } from '../services/sshStorage'
import { sshService } from '../services/sshService'
import { scanDirectory } from '../services/projectScanner'
import { getGitStatus } from '../services/gitService'
import { getListeningPorts } from '../services/portService'
import type { Project, ProjectCreationOptions, AppSettings, LogLine, CommandResult, SSHConnection, PackageManager, FileEntry } from '../../shared/types'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ─── SSH ──────────────────────────────────────────────────────────────────────
  sshService.setCallbacks(
    (sessionId, data) => mainWindow.webContents.send('ssh:data', sessionId, data),
    (status)          => mainWindow.webContents.send('ssh:status', status)
  )

  ipcMain.handle('ssh:get-connections',    async () => loadSshConnections())
  ipcMain.handle('ssh:save-connection',    async (_e, conn: SSHConnection) => saveSshConnection(conn))
  ipcMain.handle('ssh:remove-connection',  async (_e, id: string) => removeSshConnection(id))
  ipcMain.handle('ssh:connect',            async (_e, connectionId: string) => {
    const conns = loadSshConnections()
    const conn  = conns.find(c => c.id === connectionId)
    if (!conn) throw new Error(`Connection ${connectionId} not found`)
    return sshService.connect(conn)
  })
  ipcMain.handle('ssh:connect-dashboard',  async (_e, connectionId: string) => {
    const conns = loadSshConnections()
    const conn  = conns.find(c => c.id === connectionId)
    if (!conn) throw new Error(`Connection ${connectionId} not found`)
    return sshService.connectForDashboard(conn)
  })
  ipcMain.handle('ssh:exec',               async (_e, sessionId: string, command: string) => {
    return sshService.exec(sessionId, command)
  })
  ipcMain.handle('ssh:write',      async (_e, sessionId: string, data: string)               => sshService.write(sessionId, data))
  ipcMain.handle('ssh:resize',     async (_e, sessionId: string, cols: number, rows: number) => sshService.resize(sessionId, cols, rows))
  ipcMain.handle('ssh:disconnect', async (_e, sessionId: string)                             => sshService.disconnect(sessionId))

  // ─── Environment ─────────────────────────────────────────────────────────────
  ipcMain.handle('detect-environment', async () => detectEnvironment())

  // ─── File System ─────────────────────────────────────────────────────────────
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('open-directory', async (_event, dirPath: string) => {
    await shell.openPath(dirPath)
  })

  ipcMain.handle('open-in-ide', async (_event, dirPath: string, ide: string) => {
    const commands: Record<string, string> = {
      vscode: 'code', phpstorm: 'phpstorm', webstorm: 'webstorm', intellij: 'idea'
    }
    const cmd = commands[ide]
    if (!cmd) return
    const { exec } = await import('child_process')
    exec(`${cmd} "${dirPath}"`)
  })

  ipcMain.handle('path-exists', async (_event, p: string) => existsSync(p))

  ipcMain.handle('fs:read-dir', async (_event, dirPath: string): Promise<FileEntry[]> => {
    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
      return entries.map(entry => {
        const fullPath = join(dirPath, entry.name)
        const isDir = entry.isDirectory()
        let size: number | null = null
        if (!isDir) {
          try { size = statSync(fullPath).size } catch {}
        }
        const dotIdx = entry.name.lastIndexOf('.')
        const ext = (!isDir && dotIdx > 0) ? entry.name.slice(dotIdx + 1) : null
        return { name: entry.name, path: fullPath, isDirectory: isDir, size, extension: ext }
      })
    } catch {
      return []
    }
  })

  ipcMain.handle('open-external', async (_event, url: string) => shell.openExternal(url))

  ipcMain.handle('open-terminal', async (_event, dirPath: string) => {
    const { spawn } = await import('child_process')
    if (process.platform === 'win32') {
      // Try Windows Terminal, then PowerShell, then cmd
      const safe = dirPath.replace(/'/g, "''")
      try {
        spawn('wt', ['-d', dirPath], { detached: true, stdio: 'ignore' }).unref()
      } catch {
        try {
          spawn('pwsh', ['-NoExit', '-Command', `Set-Location -Path '${safe}'`], { detached: true, stdio: 'ignore' }).unref()
        } catch {
          spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/K', `cd /d "${dirPath}"`], { detached: true, stdio: 'ignore' }).unref()
        }
      }
    } else {
      await shell.openPath(dirPath)
    }
  })

  // ─── Window controls ──────────────────────────────────────────────────────────
  ipcMain.handle('window:minimize',     () => mainWindow.minimize())
  ipcMain.handle('window:maximize',     () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize())
  ipcMain.handle('window:close',        () => mainWindow.close())
  ipcMain.handle('window:is-maximized', () => mainWindow.isMaximized())

  mainWindow.on('maximize',   () => mainWindow.webContents.send('window:maximized-change', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximized-change', false))

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
    const pmExe = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm'
    return commandRunner.run({
      executable: pmExe,
      args: ['run', script],
      cwd: projectPath,
      onLog:    (log)    => mainWindow.webContents.send('task-log', log),
      onResult: (result) => mainWindow.webContents.send('task-result', result)
    })
  })

  // ─── Git ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('git:get-status', async (_event, path: string) => getGitStatus(path))

  // ─── Ports ───────────────────────────────────────────────────────────────────
  ipcMain.handle('ports:get-listening', async () => getListeningPorts())

  // ─── Project Scanner ──────────────────────────────────────────────────────────
  ipcMain.handle('scan-directory', async (_event, directory: string) => scanDirectory(directory))

  // ─── Project Storage ──────────────────────────────────────────────────────────
  ipcMain.handle('get-projects', async () => loadProjects())

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

  // ─── Settings ─────────────────────────────────────────────────────────────────
  ipcMain.handle('get-settings', async () => loadSettings())

  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    saveSettings(settings)
    app.setLoginItemSettings({
      openAtLogin: settings.startWithWindows,
      openAsHidden: settings.minimizeToTray
    })
  })
}
