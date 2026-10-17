import { spawn, type ChildProcess } from 'child_process'
import type { ProcessInfo, ProcessLog } from '@shared/types'
import { killTree } from '../../lib/killTree'

const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][A-Z0-9]/g
const MAX_LINES = 1000

interface Managed {
  info: ProcessInfo
  child: ChildProcess | null
  logs: ProcessLog[]
}

type LogCb = (log: ProcessLog) => void
type StatusCb = (info: ProcessInfo) => void

/** Long-running processes (dev servers…) with a log ring buffer each. */
class ProcessManager {
  private procs = new Map<string, Managed>()
  private onLog: LogCb = () => {}
  private onStatus: StatusCb = () => {}

  setCallbacks(onLog: LogCb, onStatus: StatusCb): void {
    this.onLog = onLog
    this.onStatus = onStatus
  }

  isRunning(key: string): boolean {
    return this.procs.get(key)?.info.status === 'running'
  }

  start(key: string, command: string, cwd: string): void {
    if (this.isRunning(key)) return

    const managed: Managed = {
      info: { key, status: 'running', pid: null, exitCode: null, startedAt: new Date().toISOString() },
      child: null,
      logs: this.procs.get(key)?.logs ?? []
    }
    this.procs.set(key, managed)
    this.push(managed, 'system', `$ ${command}  (${cwd})`)

    let child: ChildProcess
    try {
      child = spawn(command, {
        cwd,
        shell: true,
        windowsHide: true,
        detached: process.platform !== 'win32', // own process group, for killTree on unix
        env: { ...process.env, FORCE_COLOR: '0' }
      })
    } catch (err) {
      this.push(managed, 'system', `Failed to start: ${String(err)}`)
      this.setStatus(managed, 'failed', null)
      return
    }

    managed.child = child
    managed.info.pid = child.pid ?? null
    this.onStatus({ ...managed.info })

    const pipe = (stream: 'stdout' | 'stderr') => (data: Buffer) => {
      for (const line of data.toString().split(/\r?\n/)) {
        const clean = line.replace(ANSI_RE, '').trimEnd()
        if (clean) this.push(managed, stream, clean)
      }
    }
    child.stdout?.on('data', pipe('stdout'))
    child.stderr?.on('data', pipe('stderr'))

    child.on('error', err => {
      this.push(managed, 'system', err.message)
      this.setStatus(managed, 'failed', null)
    })
    child.on('close', code => {
      if (managed.info.status === 'stopped') return
      this.push(managed, 'system', `Process exited with code ${code}`)
      this.setStatus(managed, code === 0 ? 'exited' : 'failed', code)
    })
  }

  async stop(key: string): Promise<void> {
    const managed = this.procs.get(key)
    if (!managed?.child || managed.info.status !== 'running') return
    managed.info.status = 'stopped'
    await killTree(managed.child)
    this.push(managed, 'system', 'Stopped')
    this.setStatus(managed, 'stopped', null)
  }

  async stopAll(prefix = ''): Promise<void> {
    await Promise.all([...this.procs.keys()].filter(k => k.startsWith(prefix)).map(k => this.stop(k)))
  }

  list(): ProcessInfo[] {
    return [...this.procs.values()].map(m => ({ ...m.info }))
  }

  logs(key: string): ProcessLog[] {
    return this.procs.get(key)?.logs ?? []
  }

  private push(m: Managed, stream: ProcessLog['stream'], text: string): void {
    const log = { key: m.info.key, stream, text }
    m.logs.push(log)
    if (m.logs.length > MAX_LINES) m.logs.splice(0, m.logs.length - MAX_LINES)
    this.onLog(log)
  }

  private setStatus(m: Managed, status: ProcessInfo['status'], exitCode: number | null): void {
    m.info.status = status
    m.info.exitCode = exitCode
    this.onStatus({ ...m.info })
  }
}

export const processManager = new ProcessManager()
