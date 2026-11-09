import { app, dialog, ipcMain, BrowserWindow } from 'electron'
import { join, posix } from 'path'
import { loadSshConnections, getSshConnectionWithSecret, saveSshConnection, removeSshConnection, sshConnectionsEvents } from '../services/ssh/sshStorage'
import { sshService } from '../services/ssh/sshService'
import { forgetHost } from '../services/ssh/knownHosts'
import type { SSHAuthMethod, SSHConnection } from '@shared/types'

const AUTH_METHODS: SSHAuthMethod[] = ['password', 'privateKey']
// eslint-disable-next-line no-control-regex -- control characters are what we refuse
const CONTROL = /[\u0000-\u001f\u007f]/
/** A host name, an IPv4 or an IPv6 address (with its zone, fe80::1%eth0): what ssh2 dials, no space, no `user@`, no leading dash */
const HOST = /^[\p{L}\p{N}._:%-]+$/u

const invalid = (field: string) => new Error(`Invalid SSH server: ${field}`)

/** A string of at most `max` characters, without control characters; '' when absent */
function text(v: unknown, field: string, max: number): string {
  if (v === undefined || v === null) return ''
  if (typeof v !== 'string' || v.length > max || CONTROL.test(v)) throw invalid(field)
  return v
}

/**
 * The server the window asks to save, checked field by field and rebuilt: any other field
 * (an injected `passwordEnc`, for instance) is dropped.
 */
export function parseSshConnection(v: unknown): SSHConnection {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw invalid('connection')
  const c = v as Record<string, unknown>
  const id = text(c.id, 'id', 128)
  if (!/^[\w-]+$/.test(id)) throw invalid('id')
  const name = text(c.name, 'name', 200).trim()
  if (!name) throw invalid('name')
  const host = text(c.host, 'host', 255).trim()
  if (!HOST.test(host) || host.startsWith('-')) throw invalid('host')
  const username = text(c.username, 'username', 256).trim()
  if (!username) throw invalid('username')
  const port = c.port
  if (typeof port !== 'number' || !Number.isInteger(port) || port < 1 || port > 65535) throw invalid('port')
  const authMethod = c.authMethod as SSHAuthMethod
  if (!AUTH_METHODS.includes(authMethod)) throw invalid('authMethod')
  // Passwords may hold any printable character, spaces included
  if (c.password !== undefined && c.password !== null && (typeof c.password !== 'string' || c.password.length > 1024 || c.password.includes('\0'))) throw invalid('password')
  const password = authMethod === 'password' && typeof c.password === 'string' && c.password ? c.password : undefined
  // A key on a network share (\\server\share) would make Windows send the user's credentials to that server
  const keyPath = text(c.privateKeyPath, 'privateKeyPath', 4096).trim()
  if (/^[\\/]{2}/.test(keyPath)) throw invalid('privateKeyPath')
  const color = text(c.color, 'color', 9)
  if (color && !/^#[0-9a-f]{3,8}$/i.test(color)) throw invalid('color')
  const createdAt = text(c.createdAt, 'createdAt', 64)
  return {
    id, name, host, port, username, authMethod, color, createdAt,
    ...(password ? { password } : {}),
    ...(authMethod === 'privateKey' && keyPath ? { privateKeyPath: keyPath } : {})
  }
}

export function registerSshHandlers(mainWindow: BrowserWindow): void {
  sshService.setCallbacks(
    (sessionId, data) => mainWindow.webContents.send('ssh:data', sessionId, data),
    (status)          => mainWindow.webContents.send('ssh:status', status)
  )

  sshConnectionsEvents.on('changed', () => {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('ssh:connections-changed')
  })

  ipcMain.handle('ssh:get-connections',    async () => loadSshConnections())
  ipcMain.handle('ssh:save-connection',    async (_e, conn: unknown) => saveSshConnection(parseSshConnection(conn)))
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
