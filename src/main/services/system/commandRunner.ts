import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import type { CommandTask, CommandResult, LogLine } from '@shared/types'
import { killTree } from '../../lib/killTree'

// Strip ANSI escape codes (colors, bold, cursor moves, etc.)
// eslint-disable-next-line no-control-regex -- ESC and BEL are what we strip
const ANSI_RE = /\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][A-Z0-9]/g
function stripAnsi(str: string): string { return str.replace(ANSI_RE, '') }

type LogCallback = (log: LogLine) => void
type ResultCallback = (result: CommandResult) => void

interface RunOptions {
  executable: string
  args: string[]
  cwd: string
  onLog: LogCallback
  onResult: ResultCallback
}

export class CommandRunner {
  private tasks = new Map<string, { task: CommandTask; process: ChildProcess | null }>()

  run(options: RunOptions): string {
    const taskId = randomUUID()
    const task: CommandTask = {
      id: taskId,
      executable: options.executable,
      args: options.args,
      cwd: options.cwd,
      status: 'pending',
      startedAt: null,
      finishedAt: null
    }

    this.tasks.set(taskId, { task, process: null })

    this._emit(options.onLog, taskId, 'info', `> ${options.executable} ${options.args.join(' ')}`)

    task.status = 'running'
    task.startedAt = new Date().toISOString()

    let child: ChildProcess
    try {
      child = spawn(options.executable, options.args, {
        cwd: options.cwd,
        shell: true,
        windowsHide: true,
        // Nobody can answer a prompt here: it gets end-of-input instead of waiting forever
        stdio: ['ignore', 'pipe', 'pipe']
      })
    } catch (err) {
      task.status = 'failed'
      task.finishedAt = new Date().toISOString()
      this._emit(options.onLog, taskId, 'error', `Failed to start process: ${String(err)}`)
      options.onResult({ taskId, exitCode: null, status: 'failed' })
      return taskId
    }

    this.tasks.set(taskId, { task, process: child })

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        const clean = stripAnsi(line).trimEnd()
        if (clean.trim()) this._emit(options.onLog, taskId, 'stdout', clean)
      }
    })

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n')
      for (const line of lines) {
        const clean = stripAnsi(line).trimEnd()
        if (clean.trim()) this._emit(options.onLog, taskId, 'stderr', clean)
      }
    })

    child.on('close', (code: number | null) => {
      const stored = this.tasks.get(taskId)
      if (!stored) return

      // If already in a terminal state (e.g. set by 'error' event), don't double-fire
      if (stored.task.status === 'failed' || stored.task.status === 'success') return

      if (stored.task.status === 'cancelled') {
        options.onResult({ taskId, exitCode: code, status: 'cancelled' })
        return
      }

      stored.task.status = code === 0 ? 'success' : 'failed'
      stored.task.finishedAt = new Date().toISOString()

      options.onResult({ taskId, exitCode: code, status: stored.task.status })
    })

    child.on('error', (err: Error) => {
      const stored = this.tasks.get(taskId)
      if (!stored || stored.task.status === 'failed') return
      stored.task.status = 'failed'
      stored.task.finishedAt = new Date().toISOString()
      this._emit(options.onLog, taskId, 'error', err.message)
      options.onResult({ taskId, exitCode: null, status: 'failed' })
    })

    return taskId
  }

  cancel(taskId: string): void {
    const stored = this.tasks.get(taskId)
    if (!stored) return

    stored.task.status = 'cancelled'
    stored.task.finishedAt = new Date().toISOString()

    // shell: true → kill the whole tree, not just the shell
    if (stored.process) killTree(stored.process)
  }

  getTask(taskId: string): CommandTask | undefined {
    return this.tasks.get(taskId)?.task
  }

  private _emit(cb: LogCallback, taskId: string, type: LogLine['type'], text: string): void {
    cb({ taskId, type, text, timestamp: new Date().toISOString() })
  }
}

export const commandRunner = new CommandRunner()
