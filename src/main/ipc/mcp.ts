import { ipcMain } from 'electron'
import type { McpCustom } from '@shared/types'
import { addCustom, addServer, listServers, removeMcpServer, setServerEnabled, signInServer, signOutServer, testServer } from '../services/mcp/mcpService'

export function registerMcpHandlers(): void {
  const s = (v: unknown) => String(v ?? '')
  ipcMain.handle('mcp:list', () => listServers())
  ipcMain.handle('mcp:add', (_e, id: unknown) => addServer(s(id)))
  // The name and the target are checked by the service (parseCustom)
  ipcMain.handle('mcp:add-custom', (_e, c: unknown) => {
    const o = (c ?? {}) as Partial<McpCustom>
    return addCustom({ name: s(o.name), target: s(o.target) })
  })
  ipcMain.handle('mcp:remove', (_e, id: unknown) => removeMcpServer(s(id)))
  ipcMain.handle('mcp:set-enabled', (_e, id: unknown, on: unknown) => setServerEnabled(s(id), on === true))
  ipcMain.handle('mcp:sign-in', (_e, id: unknown) => signInServer(s(id)))
  ipcMain.handle('mcp:sign-out', (_e, id: unknown) => signOutServer(s(id)))
  ipcMain.handle('mcp:test', (_e, id: unknown) => testServer(s(id)))
}
