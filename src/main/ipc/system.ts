import { app, ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { arch, release, type, userInfo } from 'os'
import { log, tailLog } from '../lib/log'
import { readSchemaVersion } from '../services/storage/migrations'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs/promises'
import { detectEnvironment } from '../services/system/environmentDetector'
import { getGitStatus } from '../services/git/gitStatus'
import { freePort, getListeningPorts } from '../services/system/portService'
import { spawn } from 'child_process'
import { runFile } from '../lib/exec'
import type { FileEntry } from '@shared/types'
import { assertSafeDir, assertWebUrl, isInsideProject, launch } from '../lib/safe'

export function registerSystemHandlers(mainWindow: BrowserWindow): void {
  // ─── Environment ─────────────────────────────────────────────────────────────
  ipcMain.handle('detect-environment', async (_e, force?: boolean) => detectEnvironment(force))

  // ─── File System ─────────────────────────────────────────────────────────────
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile', 'showHiddenFiles'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('open-directory', async (_event, dirPath: string) => {
    // Folders only: openPath on a file would run it
    await shell.openPath(assertSafeDir(dirPath))
  })

  ipcMain.handle('open-in-ide', async (_event, dirPath: string, ide: string) => {
    const commands: Record<string, string> = {
      vscode: 'code', phpstorm: 'phpstorm', webstorm: 'webstorm', intellij: 'idea'
    }
    const cmd = commands[ide]
    if (!cmd) return
    if (!(await launch(cmd, [assertSafeDir(dirPath)]))) throw new Error(`${cmd} was not found in PATH`)
  })

  ipcMain.handle('path-exists', async (_event, p: string) => existsSync(p))

  ipcMain.handle('fs:read-dir', async (_event, dirPath: string): Promise<FileEntry[]> => {
    // The file tree only browses saved projects
    if (typeof dirPath !== 'string' || !isInsideProject(dirPath)) return []
    try {
      const entries = await readdir(dirPath, { withFileTypes: true })
      return Promise.all(entries.map(async entry => {
        const fullPath = join(dirPath, entry.name)
        const isDir = entry.isDirectory()
        let size: number | null = null
        if (!isDir) {
          try { size = (await stat(fullPath)).size } catch {}
        }
        const dotIdx = entry.name.lastIndexOf('.')
        const ext = (!isDir && dotIdx > 0) ? entry.name.slice(dotIdx + 1) : null
        return { name: entry.name, path: fullPath, isDirectory: isDir, size, extension: ext }
      }))
    } catch {
      return []
    }
  })

  ipcMain.handle('open-external', async (_event, url: string) => shell.openExternal(assertWebUrl(url)))

  ipcMain.handle('open-terminal', async (_event, dirPath: string) => {
    const dir = assertSafeDir(dirPath)
    if (process.platform !== 'win32') { await shell.openPath(dir); return }
    // Windows Terminal, then PowerShell 7, then Windows PowerShell, then cmd.
    // A missing program emits 'error' asynchronously, so try them in turn.
    const candidates: [string, string[]][] = [
      ['wt', ['-d', dir]],
      ['pwsh', ['-NoExit', '-Command', `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'`]],
      ['powershell', ['-NoExit', '-Command', `Set-Location -LiteralPath '${dir.replace(/'/g, "''")}'`]]
    ]
    for (const [cmd, args] of candidates) {
      const ok = await new Promise<boolean>(res => {
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore', cwd: dir })
        child.once('error', () => res(false))
        child.once('spawn', () => { child.unref(); res(true) })
      })
      if (ok) return
    }
    spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/K'], { detached: true, stdio: 'ignore', cwd: dir }).unref()
  })

  // ─── Git ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('git:get-status', async (_event, path: string) => getGitStatus(path))

  // ─── Ports ───────────────────────────────────────────────────────────────────
  ipcMain.handle('ports:get-listening', async () => getListeningPorts())

  // Ends the process listening on a port (never a Windows service)
  ipcMain.handle('ports:free', async (_e, port: number, pid: number) => { await freePort(port, pid) })

  // ─── Local log ───────────────────────────────────────────────────────────────
  ipcMain.handle('log:error', (_e, scope: string, message: string) => {
    log('error', `renderer:${String(scope).slice(0, 40)}`, String(message).slice(0, 4000))
  })
  // System details + last log lines, secrets masked: pasted into a bug ticket
  ipcMain.handle('log:report', () => [
    `${type()} ${release()} ${arch()} · Electron ${process.versions.electron} · Node ${process.versions.node}`,
    `Data format v${readSchemaVersion(app.getPath('userData'))}`,
    '',
    tailLog(200) || '(empty log)'
  ].join('\n'))

  // ─── User ────────────────────────────────────────────────────────────────────
  // First name for the home greeting: git's user.name, else the Windows account
  ipcMain.handle('system:user-name', async () => {
    const r = await runFile('git', ['config', '--global', 'user.name'], { timeout: 3000 })
    const name = (r.ok ? r.stdout.trim() : '') || userInfo().username
    return name.split(/\s+/)[0] ?? ''
  })
}
