import { readFileSync } from 'fs'
import { join } from 'path'
import { app, Notification } from 'electron'
import type { RemoteCompose, RemoteContainer, VpsStatus, WatchAlert, WatchConfig } from '@shared/types'
import { CMD_CPU, CMD_DISK, CMD_MEM, CMD_UPTIME, parseStats } from '@shared/lib/vpsStats'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { loadSettings } from '../settings/settingsService'
import { getSshConnectionWithSecret, loadSshConnections } from '../ssh/sshStorage'
import { sshService } from '../ssh/sshService'
import { shQuote } from '../ssh/sshClient'
import { appendPoint } from './history'

/**
 * Background watch of the VPS: one sample a minute over a dedicated SSH
 * session (CPU, memory, disk, containers), kept 7 days for the charts, and
 * alerts on changes: disk above the threshold, a container that stopped,
 * a server that stopped answering. The home page and Docker read from here,
 * so the SSH page never needs to be open.
 */

const EVERY = 60_000
const SEP = '@@DF@@'
const CMD_CONTAINERS = "docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' 2>/dev/null || true"
const SAMPLE = [CMD_MEM, CMD_UPTIME, CMD_DISK, CMD_CONTAINERS, CMD_CPU].join(`; echo '${SEP}'; `)

const configPath = () => join(app.getPath('userData'), 'watch.json')
const sessions = new Map<string, string>()
const statuses = new Map<string, VpsStatus>()
/** What the last sample saw, to alert on changes only */
const previous = new Map<string, { reachable: boolean; diskHigh: boolean; running: Set<string> }>()

let onStatus: (s: VpsStatus[]) => void = () => {}
let onAlert: (a: WatchAlert) => void = () => {}
let timer: ReturnType<typeof setInterval> | null = null
let ticking = false

export function watchConfig(): WatchConfig {
  try {
    const c = JSON.parse(readFileSync(configPath(), 'utf-8')) as Partial<WatchConfig>
    return { watched: Array.isArray(c.watched) ? c.watched.filter(x => typeof x === 'string') : [], diskAlert: Number(c.diskAlert) > 0 ? Number(c.diskAlert) : 85 }
  } catch {
    // First run: every saved server is watched
    return { watched: loadSshConnections().map(c => c.id), diskAlert: 85 }
  }
}

export function saveWatchConfig(u: Partial<WatchConfig>): WatchConfig {
  const c = { ...watchConfig() }
  if (Array.isArray(u.watched)) c.watched = u.watched.filter(x => typeof x === 'string')
  if (typeof u.diskAlert === 'number' && u.diskAlert >= 50 && u.diskAlert <= 99) c.diskAlert = Math.round(u.diskAlert)
  writeJsonFile(configPath(), c)
  // Servers no longer watched: forget them and close their session
  for (const id of [...statuses.keys()]) if (!c.watched.includes(id)) { statuses.delete(id); closeSession(id) }
  void watchTick()
  return c
}

export const vpsStatuses = (): VpsStatus[] => [...statuses.values()]

/** Alerts raised elsewhere (sites) reach the app the same way; they notify on their own */
export function emitAlert(kind: WatchAlert['kind'], title: string, body: string): void {
  onAlert({ kind, title, body, at: Date.now() })
}

function alert(kind: WatchAlert['kind'], title: string, body: string): void {
  const a: WatchAlert = { kind, title, body, at: Date.now() }
  log('warn', 'watch', `${title} — ${body}`)
  if (Notification.isSupported()) new Notification({ title, body }).show()
  onAlert(a)
}

function closeSession(id: string): void {
  const sid = sessions.get(id)
  if (sid) sshService.disconnect(sid)
  sessions.delete(id)
}

/** The watch's own SSH session for a server (opened once, reopened after a failure) */
export async function sessionFor(connectionId: string): Promise<string> {
  const known = sessions.get(connectionId)
  if (known) return known
  const conn = getSshConnectionWithSecret(connectionId)
  if (!conn) throw new Error('Unknown server')
  const sid = await sshService.connectForDashboard(conn)
  sessions.set(connectionId, sid)
  return sid
}

/** Runs a command on a server, reopening the session once if it was lost */
export async function runOn(connectionId: string, command: string, timeoutMs = 20_000): Promise<string> {
  try {
    return await sshService.exec(await sessionFor(connectionId), command, timeoutMs)
  } catch (err) {
    if (!/Session not found|Not connected|closed|ECONNRESET/i.test(String(err))) throw err
    closeSession(connectionId)
    return sshService.exec(await sessionFor(connectionId), command, timeoutMs)
  }
}

async function sample(connectionId: string): Promise<void> {
  const conn = loadSshConnections().find(c => c.id === connectionId)
  if (!conn) return
  const fr = loadSettings().language === 'fr'
  const prev = previous.get(connectionId)
  const base: VpsStatus = statuses.get(connectionId) ?? { connectionId, name: conn.name, state: 'connecting', at: null, cpu: null, memory: null, disk: null, containers: [] }

  let raw: string
  try {
    raw = await runOn(connectionId, SAMPLE)
  } catch (err) {
    closeSession(connectionId)
    statuses.set(connectionId, { ...base, name: conn.name, state: 'down', error: err instanceof Error ? err.message : String(err) })
    appendPoint(`vps:${connectionId}`, ['cpu', 'memory', 'disk', 'up'], [null, null, null, 0])
    if (prev?.reachable) alert('server', fr ? `${conn.name} ne répond plus` : `${conn.name} stopped answering`, `${conn.host} — ${err instanceof Error ? err.message : String(err)}`)
    previous.set(connectionId, { reachable: false, diskHigh: prev?.diskHigh ?? false, running: prev?.running ?? new Set() })
    return
  }

  const [mem = '', uptime = '', disk = '', containers = '', cpu = ''] = raw.split(SEP).map(s => s.trim())
  const s = parseStats(mem, uptime, disk, '', '', cpu)
  const root = s.disks.find(d => d.mount === '/') ?? s.disks[0]
  const memory = s.memory.total ? Math.round((s.memory.used / s.memory.total) * 1000) / 10 : null
  const list = containers.split('\n').filter(l => l.includes('|')).map(l => {
    const [name = '', image = '', status = ''] = l.split('|')
    return { name, image, status, running: /^up/i.test(status) }
  })
  const now = Date.now()
  statuses.set(connectionId, { connectionId, name: conn.name, state: 'ok', at: now, cpu: Math.round(s.cpu * 10) / 10, memory, disk: root?.pct ?? null, containers: list })
  appendPoint(`vps:${connectionId}`, ['cpu', 'memory', 'disk', 'up'], [Math.round(s.cpu * 10) / 10, memory, root?.pct ?? null, 1], now)

  // Alerts on changes since the previous sample (none on the first one)
  const threshold = watchConfig().diskAlert
  const diskHigh = (root?.pct ?? 0) >= threshold
  const running = new Set(list.filter(c => c.running).map(c => c.name))
  if (prev) {
    if (diskHigh && !prev.diskHigh) alert('disk', fr ? `Disque de ${conn.name} à ${root!.pct} %` : `${conn.name} disk at ${root!.pct} %`, fr ? `Seuil : ${threshold} %. Nettoie les images Docker ou les logs.` : `Threshold: ${threshold} %. Clean Docker images or logs.`)
    for (const name of prev.running) {
      if (!running.has(name)) {
        const c = list.find(x => x.name === name)
        alert('container', fr ? `Conteneur arrêté sur ${conn.name}` : `Container stopped on ${conn.name}`, `${name}${c ? ` — ${c.status}` : ''}`)
      }
    }
  }
  previous.set(connectionId, { reachable: true, diskHigh, running })
}

/** One round of samples (exported for tests) */
export async function watchTick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    const { watched } = watchConfig()
    const known = new Set(loadSshConnections().map(c => c.id))
    await Promise.all(watched.filter(id => known.has(id)).map(id => sample(id).catch(err => log('warn', 'watch', err))))
    onStatus(vpsStatuses())
  } finally { ticking = false }
}

export function startWatch(statusCb: (s: VpsStatus[]) => void, alertCb: (a: WatchAlert) => void): void {
  onStatus = statusCb
  onAlert = alertCb
  // A little after startup, then every minute
  setTimeout(() => { void watchTick() }, 5000)
  timer ??= setInterval(() => { void watchTick() }, EVERY)
}

export function stopWatch(): void {
  if (timer) clearInterval(timer)
  timer = null
  for (const id of [...sessions.keys()]) closeSession(id)
}

// ─── Docker on a VPS ──────────────────────────────────────────────────────────

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

export async function remoteDocker(connectionId: string): Promise<{ containers: RemoteContainer[]; compose: RemoteCompose[] }> {
  const raw = await runOn(connectionId, `docker ps -a --format '{{json .}}' 2>&1; echo '${SEP}'; docker compose ls -a --format json 2>/dev/null || echo '[]'`)
  const [ps = '', ls = '[]'] = raw.split(SEP).map(s => s.trim())
  if (/permission denied|command not found|Cannot connect to the Docker daemon/i.test(ps)) throw new Error(ps.split('\n')[0])
  const containers = ps.split('\n').filter(l => l.startsWith('{')).map(l => {
    const j = JSON.parse(l) as Record<string, string>
    const project = (j.Labels ?? '').match(/com\.docker\.compose\.project=([^,]+)/)?.[1] ?? null
    return { id: j.ID, name: j.Names, image: j.Image, state: j.State, status: j.Status, ports: j.Ports ?? '', composeProject: project }
  })
  let compose: RemoteCompose[] = []
  try { compose = (JSON.parse(ls) as { Name: string; Status: string; ConfigFiles: string }[]).map(c => ({ name: c.Name, status: c.Status, configFiles: c.ConfigFiles })) } catch { /* old compose */ }
  return { containers, compose }
}

export async function remoteDockerAction(
  connectionId: string, target: { container?: string; compose?: RemoteCompose }, action: 'start' | 'stop' | 'restart' | 'up'
): Promise<{ ok: boolean; output: string }> {
  let cmd: string
  if (target.container) {
    if (!NAME_RE.test(target.container) || action === 'up') throw new Error('Invalid container action')
    cmd = `docker ${action} ${target.container}`
  } else if (target.compose) {
    if (!NAME_RE.test(target.compose.name)) throw new Error('Invalid project name')
    const files = target.compose.configFiles.split(',').map(f => f.trim()).filter(Boolean)
    const args = action === 'up' ? 'up -d' : action
    cmd = `docker compose -p ${target.compose.name} ${files.map(f => `-f ${shQuote(f)}`).join(' ')} ${args}`
  } else throw new Error('Nothing to act on')
  const out = await runOn(connectionId, `${cmd} 2>&1; echo "${SEP}$?"`, 300_000)
  const [output = '', code = '1'] = out.split(SEP)
  return { ok: code.trim() === '0', output: output.trim() }
}

export async function remoteDockerLogs(connectionId: string, container: string, lines: number): Promise<string> {
  if (!NAME_RE.test(container)) throw new Error('Invalid container')
  const n = Math.min(1000, Math.max(10, Math.round(lines) || 200))
  return runOn(connectionId, `docker logs --tail ${n} --timestamps ${container} 2>&1`, 30_000)
}
