import { existsSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { app } from 'electron'
import type { IPty } from 'node-pty'
import type { TerminalHistoryEntry, TerminalShell } from '@shared/types'
import { BASH_INIT, CMD_PROMPT, POWERSHELL_INIT, encodePowerShell, type ShellKind } from '@shared/lib/shellBlocks'
import { writeJsonFile } from '../../lib/jsonFile'
import { assertSafeDir } from '../../lib/safe'
import { runFile } from '../../lib/exec'

/**
 * Local terminals for the block view: a real pseudo-terminal (node-pty,
 * ConPTY on Windows) per tab, its shell taught to mark its prompt.
 */

const sessions = new Map<string, IPty>()
let counter = 0

const GIT_BASH = ['C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe']
  .concat(process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe')] : [])

let pwshFound: boolean | null = null

export async function shells(): Promise<TerminalShell[]> {
  if (pwshFound === null) pwshFound = (await runFile('pwsh', ['-NoLogo', '-NoProfile', '-Command', 'exit 0'], { timeout: 8000 })).ok
  return [
    { kind: 'powershell', label: 'PowerShell', available: process.platform === 'win32' },
    { kind: 'pwsh', label: 'PowerShell 7', available: pwshFound },
    { kind: 'gitbash', label: 'Git Bash', available: GIT_BASH.some(p => existsSync(p)) },
    { kind: 'cmd', label: 'cmd', available: process.platform === 'win32' }
  ]
}

/** Git Bash reads our rc file: the user's .bashrc first, then the markers */
function bashRc(): string {
  const file = join(tmpdir(), 'devforge-bashrc')
  const content = `[ -f ~/.bashrc ] && . ~/.bashrc\n${BASH_INIT}\n`
  if (!existsSync(file) || readFileSync(file, 'utf-8') !== content) writeFileSync(file, content)
  return file
}

function command(kind: Exclude<ShellKind, 'ssh'>): { file: string; args: string[]; env?: Record<string, string> } {
  switch (kind) {
    case 'powershell': return { file: 'powershell.exe', args: ['-NoLogo', '-NoExit', '-EncodedCommand', encodePowerShell(POWERSHELL_INIT)] }
    case 'pwsh':       return { file: 'pwsh.exe', args: ['-NoLogo', '-NoExit', '-EncodedCommand', encodePowerShell(POWERSHELL_INIT)] }
    case 'gitbash': {
      const bash = GIT_BASH.find(p => existsSync(p))
      if (!bash) throw new Error('NO_GIT_BASH')
      return { file: bash, args: ['--rcfile', bashRc(), '-i'] }
    }
    // cmd reads its prompt from the environment (no quoting through the command line)
    case 'cmd':        return { file: 'cmd.exe', args: [], env: { PROMPT: CMD_PROMPT } }
  }
}

export function create(kind: Exclude<ShellKind, 'ssh'>, cwd: string, cols: number, rows: number,
  onData: (id: string, data: string) => void, onExit: (id: string, code: number) => void): string {
  const dir = assertSafeDir(cwd)
  const c = command(kind)
  // Loaded on first use: a native module, the rest of the app starts without it
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pty = require('node-pty') as typeof import('node-pty')
  const p = pty.spawn(c.file, c.args, {
    name: 'xterm-256color',
    cols: Math.max(20, Math.min(500, Math.round(cols) || 120)),
    rows: Math.max(5, Math.min(200, Math.round(rows) || 30)),
    cwd: dir,
    env: { ...process.env, TERM_PROGRAM: 'DevForge', ...c.env } as Record<string, string>,
    useConpty: true
  })
  const id = `t${++counter}`
  sessions.set(id, p)
  p.onData(d => onData(id, d))
  p.onExit(e => { sessions.delete(id); onExit(id, e.exitCode) })
  return id
}

export const write = (id: string, data: string) => { sessions.get(id)?.write(data) }

export function resize(id: string, cols: number, rows: number): void {
  try { sessions.get(id)?.resize(Math.max(20, Math.min(500, Math.round(cols))), Math.max(5, Math.min(200, Math.round(rows)))) } catch { /* exited */ }
}

export function kill(id: string): void {
  const p = sessions.get(id)
  sessions.delete(id)
  try { p?.kill() } catch { /* already gone */ }
}

export function killAll(): void {
  for (const id of [...sessions.keys()]) kill(id)
}

// ─── History, per project folder (or server) ─────────────────────────────────

const MAX_PER_KEY = 500
const historyPath = () => join(app.getPath('userData'), 'terminal-history.json')
const readHistory = (): Record<string, TerminalHistoryEntry[]> => {
  try { return JSON.parse(readFileSync(historyPath(), 'utf-8')) } catch { return {} }
}

export const history = (key: string): TerminalHistoryEntry[] => readHistory()[key.toLowerCase()] ?? []

export function addHistory(key: string, entry: TerminalHistoryEntry): void {
  const cmd = String(entry.cmd ?? '').trim()
  if (!cmd || cmd.length > 4000) return
  const all = readHistory()
  const k = key.toLowerCase()
  // The latest use only: a command run ten times is one line
  const list = (all[k] ?? []).filter(e => e.cmd !== cmd)
  list.push({ cmd, at: new Date().toISOString(), code: typeof entry.code === 'number' ? entry.code : null })
  all[k] = list.slice(-MAX_PER_KEY)
  writeJsonFile(historyPath(), all)
}
