import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow, dialog, safeStorage } from 'electron'
import type { VpnClient, VpnDetect, VpnServer } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { runOn } from '../monitor/vpsWatch'
import { openForward, sshHttp } from '../ssh/localForward'

/**
 * WireGuard on a VPS, managed through wg-easy (v15) and its REST API. wg-easy
 * listens on 127.0.0.1 of the server: every call goes through DevForge's SSH
 * session, nothing is opened to the internet. The wg-easy login is kept here,
 * encrypted by the OS, and only ever sent to wg-easy (HTTP Basic, which v15
 * accepts on its whole API).
 */

const DEFAULT_PORT = 51821

interface Stored { connectionId: string; port: number; username: string; passwordEnc: string }

const storePath = () => join(app.getPath('userData'), 'vpn.json')
function readStore(): Stored[] {
  try { return (JSON.parse(readFileSync(storePath(), 'utf-8')) as { servers?: Stored[] }).servers ?? [] } catch { return [] }
}
const writeStore = (servers: Stored[]) => writeJsonFile(storePath(), { servers })
const publicOf = (s: Stored): VpnServer => ({ connectionId: s.connectionId, port: s.port, username: s.username })

export const listServers = (): VpnServer[] => readStore().map(publicOf)

function stored(connectionId: string): Stored {
  const s = readStore().find(i => i.connectionId === connectionId)
  if (!s) throw new Error('NO_LOGIN')
  return s
}

// ─── Detection ────────────────────────────────────────────────────────────────

/** `docker ps` lines "name|image|ports" → the wg-easy container, if any */
export function parseDetect(ps: string): VpnDetect {
  for (const line of ps.split('\n')) {
    const [container = '', image = '', ports = ''] = line.trim().split('|')
    if (!/wg-easy/i.test(image)) continue
    const tag = /:([^:@/]+)$/.exec(image)?.[1] ?? null
    const version = tag && /^v?\d+(\.\d+)*$/.test(tag) ? tag.replace(/^v/, '') : null
    // "127.0.0.1:51821->51821/tcp": the host side of the web interface
    const tcp = [...ports.matchAll(/(?:[\d.]+|\[[^\]]*\]):(\d+)->(\d+)\/tcp/g)]
    const web = tcp.find(m => m[2] === String(DEFAULT_PORT)) ?? tcp[0]
    return { found: true, container, image, version, port: web ? Number(web[1]) : null, supported: version === null || Number(version.split('.')[0]) >= 15 }
  }
  return { found: false, container: null, image: null, version: null, port: null, supported: false }
}

export async function detect(connectionId: string): Promise<VpnDetect> {
  return parseDetect(await runOn(connectionId, "docker ps --format '{{.Names}}|{{.Image}}|{{.Ports}}' 2>/dev/null || true", 30_000))
}

// ─── API ──────────────────────────────────────────────────────────────────────

const basic = (username: string, password: string) => `Basic ${Buffer.from(`${username}:${password}`, 'utf-8').toString('base64')}`

async function call(connectionId: string, method: string, path: string, body?: unknown, login?: { port: number; username: string; password: string }) {
  let port: number, auth: string
  if (login) { port = login.port; auth = basic(login.username, login.password) }
  else {
    const s = stored(connectionId)
    port = s.port
    auth = basic(s.username, safeStorage.decryptString(Buffer.from(s.passwordEnc, 'base64')))
  }
  const res = await sshHttp(connectionId, port, {
    method, path: `/api${path}`,
    headers: { authorization: auth, accept: 'application/json, image/svg+xml, */*' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  })
  if (res.status === 401) throw new Error('BAD_LOGIN')
  if (res.status >= 400) {
    let msg = res.body.toString('utf-8')
    try { msg = (JSON.parse(msg) as { statusMessage?: string; message?: string }).statusMessage ?? msg } catch { /* text */ }
    throw new Error(`wg-easy ${res.status}: ${msg.slice(0, 200)}`)
  }
  return res
}

const json = async <T>(p: ReturnType<typeof call>): Promise<T> => {
  const res = await p
  try { return JSON.parse(res.body.toString('utf-8') || '{}') as T } catch { throw new Error('wg-easy answered something that is not JSON') }
}

const clientId = (v: unknown): number => {
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) throw new Error('Invalid client')
  return n
}

export async function saveLogin(connectionId: string, port: number, username: string, password: string): Promise<VpnServer> {
  const p = Number(port)
  if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error('Invalid port')
  if (!username.trim() || !password) throw new Error('BAD_LOGIN')
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
  // Checked before it is kept
  await call(connectionId, 'GET', '/client', undefined, { port: p, username: username.trim(), password })
  const all = readStore().filter(s => s.connectionId !== connectionId)
  const s: Stored = { connectionId, port: p, username: username.trim(), passwordEnc: safeStorage.encryptString(password).toString('base64') }
  all.push(s)
  writeStore(all)
  log('info', 'vpn', `wg-easy login saved for ${connectionId}`)
  return publicOf(s)
}

export function forget(connectionId: string): void {
  writeStore(readStore().filter(s => s.connectionId !== connectionId))
}

interface RawClient {
  id: number; name: string; enabled: boolean; ipv4Address: string; ipv6Address?: string | null
  createdAt?: string | null; expiresAt?: string | null; latestHandshakeAt?: string | null
  transferRx?: number | null; transferTx?: number | null
}

export async function clients(connectionId: string): Promise<VpnClient[]> {
  const raw = await json<RawClient[]>(call(connectionId, 'GET', '/client'))
  return (Array.isArray(raw) ? raw : []).map(c => ({
    id: Number(c.id), name: String(c.name ?? ''), enabled: !!c.enabled,
    ipv4: String(c.ipv4Address ?? ''), ipv6: c.ipv6Address ?? null,
    createdAt: c.createdAt ?? null, expiresAt: c.expiresAt ?? null, latestHandshakeAt: c.latestHandshakeAt ?? null,
    transferRx: typeof c.transferRx === 'number' ? c.transferRx : null, transferTx: typeof c.transferTx === 'number' ? c.transferTx : null
  })).sort((a, b) => a.name.localeCompare(b.name))
}

export async function create(connectionId: string, name: string, expiresAt: string | null): Promise<number> {
  const n = name.trim()
  if (!n || n.length > 64) throw new Error('Invalid name')
  const exp = expiresAt && /^\d{4}-\d{2}-\d{2}/.test(expiresAt) ? new Date(expiresAt).toISOString() : null
  const r = await json<{ clientId?: number }>(call(connectionId, 'POST', '/client', { name: n, expiresAt: exp }))
  log('info', 'vpn', `Client "${n}" created on ${connectionId}`)
  return clientId(r.clientId)
}

export async function remove(connectionId: string, id: number): Promise<void> {
  await call(connectionId, 'DELETE', `/client/${clientId(id)}`)
  log('info', 'vpn', `Client ${id} removed on ${connectionId}`)
}

export async function setEnabled(connectionId: string, id: number, enabled: boolean): Promise<void> {
  await call(connectionId, 'POST', `/client/${clientId(id)}/${enabled ? 'enable' : 'disable'}`)
}

/** As a data: URL, shown in an <img>: an SVG there cannot run scripts */
export async function qrcode(connectionId: string, id: number): Promise<string> {
  const res = await call(connectionId, 'GET', `/client/${clientId(id)}/qrcode.svg`)
  return `data:image/svg+xml;base64,${res.body.toString('base64')}`
}

export async function saveConfig(connectionId: string, id: number, win: BrowserWindow | null): Promise<string | null> {
  const res = await call(connectionId, 'GET', `/client/${clientId(id)}/configuration`)
  const disposition = String(res.headers['content-disposition'] ?? '')
  const name = (/filename="?([^";]+)"?/.exec(disposition)?.[1] ?? `wireguard-${id}.conf`).replace(/[^\w.=+-]/g, '-')
  const opts = { defaultPath: join(app.getPath('downloads'), name), filters: [{ name: 'WireGuard', extensions: ['conf'] }] }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (r.canceled || !r.filePath) return null
  writeFileSync(r.filePath, res.body)
  return r.filePath
}

/** wg-easy's own interface, for what this page does not cover (settings, users) */
export async function openWeb(connectionId: string): Promise<string> {
  const port = readStore().find(s => s.connectionId === connectionId)?.port ?? (await detect(connectionId)).port ?? DEFAULT_PORT
  return `http://localhost:${await openForward(connectionId, port)}`
}
