import { ipcMain, BrowserWindow } from 'electron'
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
}
