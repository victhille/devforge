import { ipcMain } from 'electron'
import type { ConnectionKind } from '@shared/types'
import { alerts, disconnect, overview, setGitIdentity, setNtfy, test } from '../services/connections/connectionsService'

const KINDS: ConnectionKind[] = ['github', 'forgy', 'vercel', 'docker', 'server', 'database', 'n8n', 'alerts']
const kindOf = (v: unknown): ConnectionKind => {
  if (!KINDS.includes(v as ConnectionKind)) throw new Error('UNKNOWN_KIND')
  return v as ConnectionKind
}
const str = (v: unknown) => typeof v === 'string' ? v : undefined

export function registerConnectionsHandlers(): void {
  ipcMain.handle('connections:overview', () => overview())
  ipcMain.handle('connections:test', (_e, kind: unknown, id: unknown) => test(kindOf(kind), str(id)))
  ipcMain.handle('connections:disconnect', (_e, kind: unknown, id: unknown) => {
    const k = kindOf(kind)
    if (k === 'docker') throw new Error('UNKNOWN_KIND')
    return disconnect(k, str(id))
  })
  ipcMain.handle('connections:alerts', (_e, id: unknown) => alerts(String(id ?? '')))
  ipcMain.handle('connections:set-ntfy', (_e, id: unknown, server: unknown, topic: unknown) => setNtfy(String(id ?? ''), String(server ?? ''), String(topic ?? '')))
  ipcMain.handle('connections:set-git-identity', (_e, name: unknown, email: unknown) => setGitIdentity(String(name ?? ''), String(email ?? '')))
}
