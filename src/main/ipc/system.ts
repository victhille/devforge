import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync, statSync } from 'fs'
import { detectEnvironment } from '../services/system/environmentDetector'
import { getGitStatus } from '../services/system/gitService'
import { getListeningPorts } from '../services/system/portService'
import type { FileEntry } from '@shared/types'

export function registerSystemHandlers(mainWindow: BrowserWindow): void {
  // ─── Environment ─────────────────────────────────────────────────────────────
  ipcMain.handle('detect-environment', async () => detectEnvironment())

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

  // ─── Git ─────────────────────────────────────────────────────────────────────
  ipcMain.handle('git:get-status', async (_event, path: string) => getGitStatus(path))

  // ─── Ports ───────────────────────────────────────────────────────────────────
  ipcMain.handle('ports:get-listening', async () => getListeningPorts())
}
