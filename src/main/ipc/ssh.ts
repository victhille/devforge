import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { join, posix } from 'path'
import { loadSshConnections, getSshConnectionWithSecret, saveSshConnection, removeSshConnection, sshConnectionsEvents } from '../services/ssh/sshStorage'
import { sshService } from '../services/ssh/sshService'
import { forgetHost } from '../services/ssh/knownHosts'
import type { SSHConnection } from '@shared/types'

export function registerSshHandlers(mainWindow: BrowserWindow): void {
  sshService.setCallbacks(
    (sessionId, data) => mainWindow.webContents.send('ssh:data', sessionId, data),
    (status)          => mainWindow.webContents.send('ssh:status', status)
  )

  sshConnectionsEvents.on('changed', () => {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('ssh:connections-changed')
  })

  ipcMain.handle('ssh:get-connections',    async () => loadSshConnections())
  ipcMain.handle('ssh:save-connection',    async (_e, conn: SSHConnection) => saveSshConnection(conn))
  ipcMain.handle('ssh:remove-connection',  async (_e, id: string) => removeSshConnection(id))
  ipcMain.handle('ssh:forget-host-key',    async (_e, id: string) => {
    const conn = loadSshConnections().find(c => c.id === id)
    if (conn) forgetHost(conn.host, conn.port)
  })
  ipcMain.handle('ssh:connect',            async (_e, connectionId: string) => {
    const conn = getSshConnectionWithSecret(connectionId)
    if (!conn) throw new Error(`Connection ${connectionId} not found`)
    return sshService.connect(conn)
  })
  ipcMain.handle('ssh:connect-dashboard',  async (_e, connectionId: string) => {
    const conn = getSshConnectionWithSecret(connectionId)
    if (!conn) throw new Error(`Connection ${connectionId} not found`)
    return sshService.connectForDashboard(conn)
  })
  ipcMain.handle('ssh:exec',               async (_e, sessionId: string, command: string) => {
    return sshService.exec(sessionId, command)
  })
  ipcMain.handle('ssh:write',      async (_e, sessionId: string, data: string)               => sshService.write(sessionId, data))
  ipcMain.handle('ssh:resize',     async (_e, sessionId: string, cols: number, rows: number) => sshService.resize(sessionId, cols, rows))
  ipcMain.handle('ssh:disconnect', async (_e, sessionId: string)                             => sshService.disconnect(sessionId))

  // The server's files, through the session already open (what its user may read, as in its terminal)
  ipcMain.handle('ssh:sftp-list', async (_e, sessionId: unknown, dir: unknown) => {
    if (typeof sessionId !== 'string' || typeof dir !== 'string' || dir.length > 4096 || dir.includes('\0')) throw new Error('Invalid path')
    return sshService.list(sessionId, dir)
  })
  ipcMain.handle('ssh:sftp-download', async (_e, sessionId: unknown, remotePath: unknown) => {
    if (typeof sessionId !== 'string' || typeof remotePath !== 'string' || !remotePath.startsWith('/') || remotePath.length > 4096 || remotePath.includes('\0')) throw new Error('Invalid path')
    // The user picks where it lands. The server's name is proposed without what Windows refuses in a
    // file name, nor the direction marks that could show "invoice‮fdp.exe" as "invoiceexe.pdf"
    const unsafe = (c: string) => { const n = c.charCodeAt(0); return n < 32 || n === 127 || n === 0x200e || n === 0x200f || (n >= 0x202a && n <= 0x202e) || (n >= 0x2066 && n <= 0x2069) || '<>:"/\\|?*'.includes(c) }
    const base = [...posix.basename(remotePath)].map(c => (unsafe(c) ? '_' : c)).join('')
    const name = base && base !== '.' && base !== '..' ? base : 'file'
    const pick = await dialog.showSaveDialog(mainWindow, { defaultPath: join(app.getPath('downloads'), name) })
    if (pick.canceled || !pick.filePath) return null
    await sshService.download(sessionId, remotePath, pick.filePath)
    return pick.filePath
  })
}
