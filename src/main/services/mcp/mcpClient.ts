import { randomBytes } from 'crypto'
import { shell } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { log } from '../../lib/log'
import { CLIENT_METADATA_URL } from './catalog'
import { LOOPBACK_URL, openLoopback, type Loopback } from '../../lib/oauthLoopback'
import { readSecret, writeSecret } from './mcpStore'
import { say } from '../../lib/say'

/**
 * DevForge as an MCP client: one connection per server, opened when Forgy or Settings needs it.
 * A server that asks for a sign-in gets it in the user's browser (OAuth with PKCE): the browser
 * comes back to this PC only (127.0.0.1), and the tokens stay encrypted in mcp.json.
 */

export interface Target {
  id: string
  name: string
  transport: 'http' | 'stdio'
  url?: string
  command?: string[]
}

export interface ToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
  readOnly: boolean
}

interface Live {
  client: Client
  tools: ToolInfo[]
  at: number
}

const live = new Map<string, Live>()
const TOOLS_TTL = 5 * 60 * 1000
const CONNECT_TIMEOUT = 15_000

export class NeedsSignIn extends Error {
  constructor() {
    super('NEEDS_SIGN_IN')
  }
}

const CLIENT_METADATA: OAuthClientMetadata = {
  client_name: 'DevForge',
  client_uri: 'https://victhille.github.io/devforge/',
  redirect_uris: [LOOPBACK_URL],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none'
}

/** The sign-in of one server. `browser`: may open the browser (a click in Settings), never from Forgy */
function provider(id: string, browser: ((url: URL) => void) | null): OAuthClientProvider {
  let state = ''
  return {
    get redirectUrl() {
      return LOOPBACK_URL
    },
    clientMetadataUrl: CLIENT_METADATA_URL,
    get clientMetadata() {
      return CLIENT_METADATA
    },
    state: () => (state = randomBytes(16).toString('hex')),
    clientInformation: () => readSecret(id).client,
    saveClientInformation: client => writeSecret(id, { client }),
    tokens: () => readSecret(id).tokens,
    saveTokens: tokens => writeSecret(id, { tokens }),
    saveCodeVerifier: verifier => writeSecret(id, { verifier }),
    codeVerifier: () => {
      const v = readSecret(id).verifier
      if (!v) throw new Error('No sign-in under way')
      return v
    },
    redirectToAuthorization: url => {
      if (!browser) throw new NeedsSignIn()
      // Only a real web address goes to the browser
      if (url.protocol !== 'https:') throw new Error(say('L’adresse de connexion n’est pas en https', 'The sign-in address is not https'))
      // The state checked when the browser comes back
      loopback?.expect(state)
      browser(url)
    }
  }
}

/** The browser's way back for the sign-in under way (one at a time) */
let loopback: Loopback | null = null

function transportFor(t: Target, browser: ((url: URL) => void) | null): Transport {
  if (t.transport === 'stdio') {
    const [command, ...args] = t.command ?? []
    if (!command) throw new Error('No command')
    // cross-spawn under the SDK: no shell, npx.cmd found on Windows
    return new StdioClientTransport({ command, args, stderr: 'ignore' })
  }
  return new StreamableHTTPClientTransport(new URL(t.url ?? ''), { authProvider: provider(t.id, browser) })
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what}: no answer after ${ms / 1000} s`)), ms))])
}

async function open(t: Target, browser: ((url: URL) => void) | null): Promise<{ client: Client; transport: Transport }> {
  const client = new Client({ name: 'DevForge', version: '1' })
  const transport = transportFor(t, browser)
  await withTimeout(client.connect(transport), CONNECT_TIMEOUT, t.name)
  return { client, transport }
}

function toolsOf(list: Awaited<ReturnType<Client['listTools']>>['tools']): ToolInfo[] {
  return list.map(tool => ({
    name: tool.name,
    title: tool.title ?? tool.annotations?.title,
    description: tool.description,
    inputSchema: (tool.inputSchema ?? { type: 'object' }) as Record<string, unknown>,
    // A tool counts as reading only when the server says so; anything else asks before it runs
    readOnly: tool.annotations?.readOnlyHint === true && tool.annotations?.destructiveHint !== true
  }))
}

/** Connected, with its tools (from memory when fresh). Never opens the browser */
export async function connect(t: Target, fresh = false): Promise<Live> {
  const cached = live.get(t.id)
  if (cached && !fresh && Date.now() - cached.at < TOOLS_TTL) return cached
  if (cached) await close(t.id)
  try {
    const { client } = await open(t, null)
    const tools = toolsOf((await withTimeout(client.listTools(), CONNECT_TIMEOUT, t.name)).tools)
    const entry = { client, tools, at: Date.now() }
    live.set(t.id, entry)
    return entry
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof NeedsSignIn) throw new NeedsSignIn()
    throw err
  }
}

/** A click on « Se connecter »: the browser opens, the user accepts, the server is connected */
export async function signIn(t: Target): Promise<Live> {
  if (t.transport !== 'http') return connect(t, true)
  const cb = openLoopback()
  loopback = cb
  try {
    await close(t.id)
    const client = new Client({ name: 'DevForge', version: '1' })
    const transport = new StreamableHTTPClientTransport(new URL(t.url ?? ''), {
      authProvider: provider(t.id, url => void shell.openExternal(url.toString()))
    })
    try {
      await withTimeout(client.connect(transport), CONNECT_TIMEOUT, t.name)
      // Already signed in (a saved token still works)
    } catch (err) {
      if (!(err instanceof UnauthorizedError)) throw err
      await transport.finishAuth(await cb.code)
      writeSecret(t.id, { verifier: undefined })
      log('info', 'mcp', `Signed in to ${t.name}`)
    }
    return await connect(t, true)
  } finally {
    // The callback port is closed in every case
    cb.stop()
    loopback = null
  }
}

export async function callTool(t: Target, name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
  const { client } = await connect(t)
  const r = await withTimeout(client.callTool({ name, arguments: args }), 120_000, t.name)
  const parts = (Array.isArray(r.content) ? r.content : []) as { type: string; text?: string; resource?: { text?: string; uri?: string } }[]
  const text = parts
    .map(p => (p.type === 'text' ? (p.text ?? '') : p.type === 'resource' ? (p.resource?.text ?? p.resource?.uri ?? '') : `[${p.type}]`))
    .join('\n')
  return { text: text || (r.structuredContent ? JSON.stringify(r.structuredContent) : ''), isError: r.isError === true }
}

export async function close(id: string): Promise<void> {
  const l = live.get(id)
  live.delete(id)
  await l?.client.close().catch(() => {})
}

/** When DevForge quits: the servers run on this PC stop with it */
export function closeAll(): void {
  for (const id of [...live.keys()]) void close(id)
}

export const cachedTools = (id: string): ToolInfo[] | null => live.get(id)?.tools ?? null
