import { readFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { OAuthClientInformationMixed, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import { writeJsonFile } from '../../lib/jsonFile'

/**
 * The MCP servers added in Settings › Connections, and their sign-ins. A sign-in (tokens, the
 * registration DevForge got from the server, the PKCE verifier of a sign-in under way) is encrypted
 * by Windows like DevForge's other secrets; the window never receives it.
 */

export interface StoredServer {
  id: string
  enabled: boolean
  /** A server added by hand: its name and its address or command */
  custom?: { name: string; target: string }
}

export interface Secret {
  tokens?: OAuthTokens
  client?: OAuthClientInformationMixed
  verifier?: string
}

interface File {
  servers: StoredServer[]
  /** id → encrypted Secret (base64) */
  secrets: Record<string, string>
}

const path = () => join(app.getPath('userData'), 'mcp.json')

function read(): File {
  try {
    const f = JSON.parse(readFileSync(path(), 'utf-8')) as Partial<File>
    return {
      servers: Array.isArray(f.servers) ? f.servers.filter(s => s && typeof s.id === 'string') : [],
      secrets: f.secrets && typeof f.secrets === 'object' ? f.secrets : {}
    }
  } catch {
    return { servers: [], secrets: {} }
  }
}

export const storedServers = (): StoredServer[] => read().servers

export function saveServer(server: StoredServer): void {
  const f = read()
  const i = f.servers.findIndex(s => s.id === server.id)
  if (i >= 0) f.servers[i] = server
  else f.servers.push(server)
  writeJsonFile(path(), f)
}

export function removeServer(id: string): void {
  const f = read()
  f.servers = f.servers.filter(s => s.id !== id)
  delete f.secrets[id]
  writeJsonFile(path(), f)
}

export function readSecret(id: string): Secret {
  const enc = read().secrets[id]
  if (!enc) return {}
  try {
    return JSON.parse(safeStorage.decryptString(Buffer.from(enc, 'base64'))) as Secret
  } catch {
    return {}
  }
}

/** Merges into the saved sign-in; `null` forgets it */
export function writeSecret(id: string, patch: Partial<Secret> | null): void {
  const f = read()
  if (patch === null) delete f.secrets[id]
  else {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
    const next = { ...readSecret(id), ...patch }
    f.secrets[id] = safeStorage.encryptString(JSON.stringify(next)).toString('base64')
  }
  writeJsonFile(path(), f)
}
