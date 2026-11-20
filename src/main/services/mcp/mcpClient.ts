import { createServer, type Server } from 'http'
import { randomBytes } from 'crypto'
import { shell } from 'electron'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientMetadata } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { log } from '../../lib/log'
import { CALLBACK_PORT, CALLBACK_URL, CLIENT_METADATA_URL } from './catalog'
import { readSecret, writeSecret } from './mcpStore'
import { say } from './say'

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
const SIGN_IN_TIMEOUT = 5 * 60 * 1000

export class NeedsSignIn extends Error {
  constructor() {
    super('NEEDS_SIGN_IN')
  }
}

const CLIENT_METADATA: OAuthClientMetadata = {
  client_name: 'DevForge',
  client_uri: 'https://victhille.github.io/devforge/',
  redirect_uris: [CALLBACK_URL],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none'
}

/** The sign-in of one server. `browser`: may open the browser (a click in Settings), never from Forgy */
function provider(id: string, browser: ((url: URL) => void) | null): OAuthClientProvider {
  let state = ''
  return {
    get redirectUrl() {
      return CALLBACK_URL
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
      pendingState = state
      browser(url)
    }
  }
}

/** The state of the sign-in under way (one at a time), empty when none: the browser must bring it back */
let pendingState = ''
let signingIn = false

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

/**
 * The browser comes back here with the code; nothing else is answered. A request without the state
 * of the sign-in under way (another page calling the port) is refused and the wait goes on.
 */
function callback(): { code: Promise<string>; stop: () => void } {
  let server: Server | null = null
  let timer: NodeJS.Timeout | undefined
  const stop = () => {
    clearTimeout(timer)
    server?.close()
    server = null
  }
  const code = new Promise<string>((resolve, reject) => {
    const s = createServer((req, res) => {
      const url = new URL(req.url ?? '/', CALLBACK_URL)
      if (url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }
      const mine = !!pendingState && url.searchParams.get('state') === pendingState
      const got = url.searchParams.get('code')
      const ok = mine && !!got
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" })
      res.end(page(ok))
      if (!mine) return
      if (got) resolve(got)
      else reject(new Error(url.searchParams.get('error_description') || url.searchParams.get('error') || say('Connexion refusée', 'Sign-in refused')))
    })
    server = s
    s.once('error', (err: NodeJS.ErrnoException) =>
      reject(
        new Error(
          err.code === 'EADDRINUSE'
            ? say(
                `Le port ${CALLBACK_PORT} est déjà pris : ferme ce qui l’utilise et réessaie`,
                `Port ${CALLBACK_PORT} is already used: close what uses it and try again`
              )
            : err.message
        )
      )
    )
    s.listen(CALLBACK_PORT, '127.0.0.1')
    timer = setTimeout(() => reject(new Error(say('Connexion pas terminée après 5 minutes', 'Sign-in not finished after 5 minutes'))), SIGN_IN_TIMEOUT)
  })
  // Read by the sign-in only when the server asks for one
  code.catch(() => {})
  return { code, stop }
}

const page = (ok: boolean) =>
  `<!doctype html><meta charset="utf-8"><title>DevForge</title><body style="font-family:Segoe UI,sans-serif;background:#121110;color:#F2EEE9;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font-size:22px">${ok ? 'DevForge est connecté · DevForge is connected' : 'Connexion refusée · Sign-in refused'}</h1><p style="color:#B5ADA4">${ok ? 'Tu peux fermer cet onglet et revenir à DevForge. · You can close this tab.' : 'Reviens à DevForge pour réessayer. · Go back to DevForge to try again.'}</p></div></body>`

/** A click on « Se connecter »: the browser opens, the user accepts, the server is connected */
export async function signIn(t: Target): Promise<Live> {
  if (t.transport !== 'http') return connect(t, true)
  if (signingIn) throw new Error(say('Une autre connexion est en cours : termine-la d’abord', 'Another sign-in is under way: finish it first'))
  signingIn = true
  pendingState = ''
  const cb = callback()
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
    pendingState = ''
    signingIn = false
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
