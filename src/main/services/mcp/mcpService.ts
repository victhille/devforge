import { randomUUID } from 'crypto'
import type { McpCustom, McpServer, McpState } from '@shared/types'
import { log } from '../../lib/log'
import { CATALOG, catalogEntry } from './catalog'
import { NeedsSignIn, cachedTools, close, connect, signIn as browserSignIn, type Target } from './mcpClient'
import { readSecret, removeServer, saveServer, storedServers, writeSecret, type StoredServer } from './mcpStore'
import { say } from './say'

/** The last error of a server, kept for the list (the window shows it under the server) */
const errors = new Map<string, string>()

/**
 * What a server added by hand runs: an https address (http only on this PC), or a command split
 * into words, without any shell (tested)
 */
export function parseCustom(raw: string): Pick<Target, 'transport' | 'url' | 'command'> {
  const target = raw.trim()
  if (!target || target.length > 500) throw new Error(say('Donne une adresse ou une commande', 'Give an address or a command'))
  if (/^https?:\/\//i.test(target)) {
    const url = new URL(target)
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    if (url.protocol !== 'https:' && !local)
      throw new Error(say('L’adresse doit être en https (http seulement pour ce PC)', 'An address must be https (http only for this PC)'))
    // A key in the address would be kept in clear and shown: the server asks for a sign-in itself
    if (url.username || url.password || [...url.searchParams.keys()].some(k => /key|token|secret|pass|auth|sig/i.test(k)))
      throw new Error(
        say(
          'Pas de mot de passe ni de clé dans l’adresse : le serveur demande lui-même la connexion',
          'No password or key in the address: the server asks for a sign-in itself'
        )
      )
    return { transport: 'http', url: url.toString() }
  }
  const words: string[] = []
  for (const m of target.matchAll(/"([^"]*)"|(\S+)/g)) words.push(m[1] ?? m[2])
  // The words go to the program as they are: no shell reads them, but none of its operators belong here
  if (words.some(w => /[&|<>^`]/.test(w))) throw new Error(say('Une commande sans &, |, <, > ni ^', 'A command without &, |, <, > or ^'))
  return { transport: 'stdio', command: words }
}

function targetOf(s: StoredServer | { id: string }): Target | null {
  const c = catalogEntry(s.id)
  if (c) return { id: c.id, name: c.name, transport: c.transport, url: c.url, command: c.command }
  const custom = 'custom' in s ? s.custom : undefined
  if (!custom) return null
  try {
    return { id: s.id, name: custom.name, ...parseCustom(custom.target) }
  } catch {
    return null
  }
}

function view(id: string, stored: StoredServer | undefined): McpServer | null {
  const c = catalogEntry(id)
  const t = stored ? targetOf(stored) : c ? targetOf({ id }) : null
  if (!t) return null
  const tools = cachedTools(id)
  const signedIn = !!readSecret(id).tokens
  const auth = c?.auth ?? (t.transport === 'stdio' ? 'local' : 'oauth')
  const error = errors.get(id) ?? null
  const state: McpState = !stored
    ? 'off'
    : error === 'NEEDS_SIGN_IN'
      ? 'needs-login'
      : error
        ? 'error'
        : tools
          ? 'ready'
          : auth === 'oauth' && !signedIn
            ? 'needs-login'
            : 'off'
  return {
    id,
    name: t.name,
    transport: t.transport,
    auth,
    target: t.transport === 'http' ? (t.url ?? '') : (t.command ?? []).join(' '),
    catalog: !!c,
    added: !!stored,
    enabled: stored?.enabled ?? false,
    state,
    error: error === 'NEEDS_SIGN_IN' ? null : error,
    tools: tools?.length ?? 0,
    readOnlyTools: tools?.filter(x => x.readOnly).length ?? 0,
    signedIn
  }
}

export function listServers(): McpServer[] {
  const stored = storedServers()
  const ids = [...CATALOG.map(c => c.id), ...stored.filter(s => !catalogEntry(s.id)).map(s => s.id)]
  return ids
    .map(id =>
      view(
        id,
        stored.find(s => s.id === id)
      )
    )
    .filter((s): s is McpServer => !!s)
}

const one = (id: string): McpServer => {
  const s = view(
    id,
    storedServers().find(x => x.id === id)
  )
  if (!s) throw new Error(say('Serveur MCP inconnu', 'Unknown MCP server'))
  return s
}

/** What a connection made for Forgy gave: shown under the server in Settings (null: it answered) */
export function noteConnection(id: string, err: unknown): void {
  if (!err) errors.delete(id)
  else errors.set(id, err instanceof NeedsSignIn ? 'NEEDS_SIGN_IN' : err instanceof Error ? err.message.slice(0, 300) : String(err).slice(0, 300))
}

/** Connects (no browser) and keeps the outcome for the list */
async function refresh(id: string): Promise<McpServer> {
  const stored = storedServers().find(s => s.id === id)
  const t = stored ? targetOf(stored) : null
  if (!t) return one(id)
  try {
    await connect(t, true)
    noteConnection(id, null)
  } catch (err) {
    noteConnection(id, err)
  }
  return one(id)
}

export async function addServer(id: string): Promise<McpServer> {
  const c = catalogEntry(String(id))
  if (!c) throw new Error(say('Serveur MCP inconnu', 'Unknown MCP server'))
  saveServer({ id: c.id, enabled: true })
  log('info', 'mcp', `Added ${c.name}`)
  return c.auth === 'oauth' ? signInServer(c.id) : refresh(c.id)
}

export async function addCustom(custom: McpCustom): Promise<McpServer> {
  const name = String(custom?.name ?? '')
    .trim()
    .slice(0, 60)
  if (!name) throw new Error(say('Donne un nom au serveur', 'Give the server a name'))
  parseCustom(String(custom?.target ?? ''))
  const id = `custom-${randomUUID().slice(0, 8)}`
  saveServer({ id, enabled: true, custom: { name, target: String(custom.target).trim() } })
  log('info', 'mcp', `Added the server ${name}`)
  return refresh(id)
}

export async function removeMcpServer(id: string): Promise<void> {
  await close(String(id))
  errors.delete(String(id))
  removeServer(String(id))
}

export async function setServerEnabled(id: string, enabled: boolean): Promise<McpServer> {
  const s = storedServers().find(x => x.id === id)
  if (!s) throw new Error(say('Serveur MCP inconnu', 'Unknown MCP server'))
  saveServer({ ...s, enabled: enabled === true })
  if (!enabled) await close(id)
  return enabled ? refresh(id) : one(id)
}

export async function signInServer(id: string): Promise<McpServer> {
  const stored = storedServers().find(s => s.id === id)
  const t = stored ? targetOf(stored) : null
  if (!t) throw new Error(say('Serveur MCP inconnu', 'Unknown MCP server'))
  try {
    await browserSignIn(t)
    errors.delete(id)
  } catch (err) {
    errors.set(id, err instanceof Error ? err.message.slice(0, 300) : String(err))
    log('warn', 'mcp', `Sign-in to ${t.name}: ${errors.get(id)}`)
  }
  return one(id)
}

export async function signOutServer(id: string): Promise<McpServer> {
  await close(id)
  writeSecret(id, null)
  errors.delete(id)
  return one(id)
}

export const testServer = (id: string) => refresh(String(id))

/** The servers Forgy may use, with how to reach them */
export const forgyTargets = (): Target[] =>
  storedServers()
    .filter(s => s.enabled)
    .map(targetOf)
    .filter((t): t is Target => !!t)
