import { execFile } from 'child_process'
import { readdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import type { IPty } from 'node-pty'
import type { ExpoCheck, ExpoKey, ExpoLog, ExpoProject, ExpoStartOptions, ExpoStatus } from '@shared/types'
import { stripAnsi } from '@shared/lib/ansi'
import { log, redact } from '../../lib/log'
import { killPidTree } from '../../lib/killTree'
import { loadProjects } from '../projects/projectStorage'
import { readJson } from '../packages/npmPackages'

/**
 * Expo: the React Native apps among the DevForge projects, and one Metro server at a time.
 * `expo start` runs in a real pseudo-terminal (node-pty, as the terminal does): its keys
 * (a, w, r, m, j, s) then work as in a terminal, and the page sends them. The QR code's
 * address comes from the dev server itself (`/_expo/open`), else from Metro's log.
 */

// ─── Which folders are Expo apps ─────────────────────────────────────────────

const SUB_RE = /^(?:apps|packages)\/[\w.-]{1,80}$/
const MAX_SUBS = 40

interface Pkg {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

const readPkg = (dir: string) => readJson(join(dir, 'package.json')) as Pkg | null

/** ~54.0.12, ^53.0.0, 54.0.0-preview.1 → 54 */
export function sdkOf(version: string | undefined): number | null {
  const m = version?.match(/(\d+)\./)
  return m ? Number(m[1]) : null
}

function subFolders(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
      .map(e => e.name)
      .slice(0, MAX_SUBS)
  } catch {
    return []
  }
}

/** The Expo apps of one project: itself, or the apps/* and packages/* of its monorepo */
export function findExpoApps(project: { id: string; name: string; path: string }): ExpoProject[] {
  const found: ExpoProject[] = []
  const add = (dir: string, sub: string | null) => {
    const pkg = readPkg(dir)
    const deps = { ...pkg?.dependencies, ...pkg?.devDependencies }
    if (!deps.expo) return
    found.push({
      id: sub ? `${project.id}/${sub}` : project.id,
      projectId: project.id,
      name: sub ? (pkg?.name ?? sub.split('/')[1]) : project.name,
      label: sub ? `${project.name}/${sub}` : project.name,
      sdk: sdkOf(deps.expo),
      router: !!deps['expo-router'],
      devClient: !!deps['expo-dev-client']
    })
  }
  add(project.path, null)
  for (const parent of ['apps', 'packages']) {
    const names = subFolders(join(project.path, parent))
    for (const n of names) if (SUB_RE.test(`${parent}/${n}`)) add(join(project.path, parent, n), `${parent}/${n}`)
  }
  return found
}

export const expoProjects = (): ExpoProject[] => loadProjects().flatMap(p => findExpoApps(p))

/** The folder of an app, from its id, only among the registered projects (never a path from the window) */
function folderOf(id: string): { app: ExpoProject; dir: string } {
  const projects = loadProjects()
  for (const p of projects) {
    const hit = findExpoApps(p).find(a => a.id === id)
    if (hit) return { app: hit, dir: hit.id === p.id ? p.path : join(p.path, ...hit.id.slice(p.id.length + 1).split('/')) }
  }
  throw new Error('Unknown Expo project')
}

// ─── The command ─────────────────────────────────────────────────────────────

export function checkOptions(o: ExpoStartOptions): ExpoStartOptions {
  if (!o || !['go', 'dev'].includes(o.target)) throw new Error('Invalid target')
  if (!['lan', 'tunnel', 'localhost'].includes(o.connection)) throw new Error('Invalid connection')
  if (!Number.isInteger(o.port) || o.port < 1024 || o.port > 65535) throw new Error('Port must be a number from 1024 to 65535')
  return { target: o.target, connection: o.connection, port: o.port, clear: o.clear === true }
}

/** `expo start` with fixed words only: nothing typed in the window reaches the command line */
export function startArgs(o: ExpoStartOptions): string[] {
  return [
    'expo',
    'start',
    '--port',
    String(o.port),
    o.target === 'dev' ? '--dev-client' : '--go',
    ...(o.connection === 'tunnel' ? ['--tunnel'] : o.connection === 'localhost' ? ['--localhost'] : []),
    ...(o.clear ? ['--clear'] : [])
  ]
}

/** npx, through cmd on Windows (npx is a .cmd); end-to-end tests run a local stand-in instead */
function command(args: string[]): { file: string; args: string[]; env: Record<string, string> } {
  // The stand-in is a script for node (Electron as node writes nothing in a pseudo-console on Windows)
  const fake = !app.isPackaged ? process.env.DEVFORGE_TEST_EXPO_CMD : undefined
  const [bin, ...rest] = fake ? ['node', /\s/.test(fake) ? `"${fake}"` : fake, ...args] : ['npx', ...args]
  if (process.platform === 'win32') return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', [bin, ...rest].join(' ')], env: {} }
  return { file: bin, args: fake ? [fake, ...args] : rest, env: {} }
}

function childEnv(extra: Record<string, string>): Record<string, string> {
  const env = { ...process.env, FORCE_COLOR: '0', EXPO_NO_QR_CODE: '1', ...extra } as Record<string, string>
  // Interactive on purpose: in CI mode Expo turns its keys off
  delete env.CI
  return env
}

// ─── Reading Metro's output ──────────────────────────────────────────────────

/** One line as a person reads it: no colors or cursor moves, the last rewrite of a line kept */
export function cleanLine(raw: string): string {
  const parts = stripAnsi(raw).split('\r')
  return (parts.filter(p => p.trim()).pop() ?? '').trimEnd()
}

export function urlIn(line: string): string | null {
  return line.match(/\b(exp(?:\+[\w-]+)?:\/\/[^\s'"<>]+)/)?.[1] ?? null
}

/** `expo install --check`: "  react-native-reanimated@3.10.1 - expected version: ~3.16.1" */
export function parseCheck(output: string): ExpoCheck['packages'] {
  const out: ExpoCheck['packages'] = []
  for (const m of output.matchAll(/^\s*(@?[\w./-]+)@(\S+)\s+-\s+expected version:\s+(\S+)/gm)) out.push({ name: m[1], installed: m[2], expected: m[3] })
  return out
}

// ─── The server ──────────────────────────────────────────────────────────────

const MAX_LOGS = 500
let pty: IPty | null = null
let status: ExpoStatus = { id: null, state: 'stopped', port: null, url: null, options: null, needsNgrok: false }
let logs: ExpoLog[] = []
let pending = ''
let poll: NodeJS.Timeout | null = null
let onLog: (l: ExpoLog) => void = () => {}
let onStatus: (s: ExpoStatus) => void = () => {}

export function setExpoCallbacks(logCb: typeof onLog, statusCb: typeof onStatus): void {
  onLog = logCb
  onStatus = statusCb
}

export const expoStatus = (): ExpoStatus => ({ ...status })
export const expoLogs = (): ExpoLog[] => logs

function set(patch: Partial<ExpoStatus>): void {
  status = { ...status, ...patch }
  onStatus(expoStatus())
}

function push(stream: ExpoLog['stream'], text: string): void {
  // Masked like DevForge's own log: these lines are shown, and can be handed to Forgy
  const entry = { id: status.id ?? '', stream, text: redact(text) }
  logs = [...logs, entry].slice(-MAX_LOGS)
  onLog(entry)
}

function read(chunk: string): void {
  const lines = (pending + chunk).split('\n')
  pending = lines.pop() ?? ''
  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue
    push('out', line)
    if (/@expo\/ngrok/.test(line) && /install/i.test(line)) set({ needsNgrok: true })
    const url = urlIn(line)
    if (url && !status.url) set({ url, state: 'running' })
  }
}

/** The dev server says which link opens the app (a tunnel's too), once Metro answers */
function followUrl(port: number, target: ExpoStartOptions['target']): void {
  const runtime = target === 'go' ? 'expo' : 'custom'
  const started = Date.now()
  poll = setInterval(async () => {
    if (status.url || Date.now() - started > 120_000) return stopPoll()
    try {
      const res = await fetch(`http://127.0.0.1:${port}/_expo/open?platform=android&runtime=${runtime}`, { signal: AbortSignal.timeout(2000) })
      const url = res.ok ? ((await res.json()) as { url?: unknown }).url : null
      if (typeof url === 'string' && /^(exp|https?|[a-z][\w+.-]*):\/\//i.test(url) && !status.url) set({ url, state: 'running' })
    } catch {
      /* not up yet */
    }
  }, 1500)
}

function stopPoll(): void {
  if (poll) clearInterval(poll)
  poll = null
}

export async function startExpo(id: string, options: ExpoStartOptions): Promise<ExpoStatus> {
  const o = checkOptions(options)
  const { app: target, dir } = folderOf(String(id))
  stopExpo()
  logs = []
  pending = ''
  status = { id: target.id, state: 'starting', port: o.port, url: null, options: o, needsNgrok: false }
  onStatus(expoStatus())
  const c = command(startArgs(o))
  push('system', `$ npx ${startArgs(o).join(' ')}  (${target.label})`)
  try {
    // A native module, loaded on first use
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- node-pty is a native module: loaded on first use, not at startup
    const nodePty = require('node-pty') as typeof import('node-pty')
    const p = nodePty.spawn(c.file, c.args, { name: 'xterm-256color', cols: 120, rows: 30, cwd: dir, env: childEnv(c.env), useConpty: true })
    pty = p
    p.onData(read)
    p.onExit(e => {
      if (pty !== p) return
      pty = null
      stopPoll()
      if (pending.trim()) read('\n')
      push('system', `Expo exited with code ${e.exitCode}`)
      set({ state: status.state === 'stopped' ? 'stopped' : e.exitCode === 0 ? 'stopped' : 'failed', url: null })
    })
  } catch (err) {
    push('system', `Failed to start: ${err instanceof Error ? err.message : String(err)}`)
    set({ state: 'failed' })
    return expoStatus()
  }
  followUrl(o.port, o.target)
  log('info', 'expo', `Started ${target.label} on port ${o.port}`)
  return expoStatus()
}

/** `quitting`: the tree is killed before this returns, else Metro would outlive DevForge */
export function stopExpo(quitting = false): ExpoStatus {
  stopPoll()
  const p = pty
  pty = null
  if (p) {
    // The tree first (cmd, npx, node, Metro), while its root still links them; then the pseudo-terminal
    killPidTree(p.pid, quitting)
    try {
      p.kill()
    } catch {
      /* gone */
    }
    push('system', 'Stopped')
  }
  if (status.state !== 'stopped') set({ state: 'stopped', url: null, needsNgrok: false })
  return expoStatus()
}

const KEYS: ExpoKey[] = ['a', 'w', 'r', 'm', 'j', 's']
export function sendKey(key: ExpoKey): void {
  if (!KEYS.includes(key)) throw new Error('Invalid key')
  if (!pty) throw new Error('Expo is not running')
  pty.write(key)
}

/** Expo asks "install @expo/ngrok?" in its terminal: the answer is yes */
export function answerNgrok(): void {
  if (!pty || !status.needsNgrok) throw new Error('Expo is not asking')
  pty.write('y\r')
  set({ needsNgrok: false })
}

function runExpo(dir: string, args: string[], extraEnv: Record<string, string>): Promise<{ ok: boolean; output: string }> {
  const c = command(args)
  return new Promise(resolve =>
    execFile(
      c.file,
      c.args,
      { cwd: dir, env: { ...process.env, ...c.env, ...extraEnv, FORCE_COLOR: '0' }, timeout: 300_000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => resolve({ ok: !err, output: stripAnsi(`${stdout ?? ''}\n${stderr ?? ''}`) })
    )
  )
}

export async function checkVersions(id: string): Promise<ExpoCheck> {
  const { dir } = folderOf(String(id))
  // CI: no question, and a non-zero exit when a package is off
  const r = await runExpo(dir, ['expo', 'install', '--check'], { CI: '1' })
  const packages = parseCheck(r.output)
  return { ok: r.ok && packages.length === 0, packages, output: redact(r.output.trim()).slice(-4000) }
}

export async function fixVersions(id: string): Promise<ExpoCheck> {
  const { app: target, dir } = folderOf(String(id))
  const r = await runExpo(dir, ['expo', 'install', '--fix'], { CI: '1' })
  log('info', 'expo', `Aligned the packages of ${target.label}`)
  if (!r.ok) return { ok: false, packages: [], output: redact(r.output.trim()).slice(-4000) }
  return checkVersions(id)
}
