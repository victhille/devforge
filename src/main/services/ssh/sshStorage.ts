import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { SSHConnection } from '@shared/types'

function getPath(): string {
  return join(app.getPath('userData'), 'ssh-connections.json')
}

export function loadSshConnections(): SSHConnection[] {
  const path = getPath()
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as SSHConnection[]
  } catch {
    return []
  }
}

function persist(conns: SSHConnection[]): void {
  const path = getPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(conns, null, 2), 'utf-8')
}

export function saveSshConnection(conn: SSHConnection): void {
  const conns = loadSshConnections()
  const idx = conns.findIndex(c => c.id === conn.id)
  if (idx >= 0) conns[idx] = conn
  else conns.push(conn)
  persist(conns)
}

export function removeSshConnection(id: string): void {
  persist(loadSshConnections().filter(c => c.id !== id))
}
