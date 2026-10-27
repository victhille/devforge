import { spawn, ChildProcess } from 'child_process'
import { randomUUID } from 'crypto'
import { isUtf8 } from 'buffer'
import type { CommandTask, CommandResult, LogLine } from '@shared/types'
import { killTree } from '../../lib/killTree'

// Strip ANSI escape codes (colors, bold, cursor moves, etc.), and OSC sequences such as
// OSC 8 links (]8;;file://…), ended by BEL or by ESC \
// eslint-disable-next-line no-control-regex -- ESC and BEL are what we strip
const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][A-Z0-9]/g
export function stripAnsi(str: string): string { return str.replace(ANSI_RE, '') }

/** Lines that come by the hundred and say the same thing: one is shown, then the count */
const SAME_KIND: [RegExp, string][] = [
  [/LF will be replaced by CRLF|CRLF will be replaced by LF/, 'crlf'],
  // What a Docker build step prints (apt, npm… inside the image): its "#7 [ 5/15] RUN …" title and "#7 DONE" stay
  [/^#\d+ (\d+\.\d+ |sha256:|extracting |resolve |\.\.\.$)/, 'build']
]

/** PHP's deprecation notices (an older Composer on a newer PHP): scattered through the whole output, so counted over all of it */
const NOTICE = /^\s*(PHP )?Deprecation Notice:/

/** A progress bar redrawn in place (Composer: "  10/100 [==>---]  10%"): nothing to read once the line is final */
const PROGRESS = /^[\s\d/%]*(\[[=>\-\s]*\][\s\d/%]*)+$|^\(Reading database \.\.\.( \d+%)?$/
const PROGRESS_PREFIX = /^[\s\d/%]*(\[[=>\-\s]*\][\s\d/%]*)+(?=\S)/

/**
 * Collapses a run of lines of one kind (or the same line again) into its first
 * line and a "… (+N)" line, shows the first deprecation notice only and counts
 * the others, so a log of thousands of warnings stays readable
 */
export function lineCollapser(emit: (text: string, type: 'stdout' | 'stderr') => void) {
  let key: string | null = null, extra = 0, lastType: 'stdout' | 'stderr' = 'stdout'
  let notices = 0, composer = false
  const flush = () => {
    if (extra > 0) emit(`… (+${extra})`, lastType)
    key = null; extra = 0
  }
  return {
    push(line: string, type: 'stdout' | 'stderr') {
      if (PROGRESS.test(line)) return
      // A message written right after a bar, on its line
      const text = line.replace(PROGRESS_PREFIX, '')
      if (NOTICE.test(text)) {
        composer ||= /composer\.phar|[\\/]composer[\\/]/i.test(text)
        if (notices++ > 0) return
      }
      const k = SAME_KIND.find(([re]) => re.test(text))?.[1] ?? text
      if (k === key) { extra++; lastType = type; return }
      flush()
      key = k; lastType = type
      emit(text, type)
    },
    flush,
    /** At the end of the command: the count of the hidden notices, and what to do when Composer is behind PHP */
    end() {
      flush()
      if (notices > 1) emit(`… (+${notices - 1}) Deprecation Notice${composer ? ' — composer self-update' : ''}`, 'stderr')
      notices = 0
    }
  }
}

/** Code page 850, bytes 0x80 to 0xFF: cmd's own messages ('x' n'est pas reconnu…) on a French or Western Windows */
const CP850 = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\u00ad±‗¾¶§÷¸°¨·¹³²■\u00a0'

/** A line's bytes as text: UTF-8 when they are valid UTF-8 (most tools), code page 850 otherwise */
export function decodeLine(bytes: Buffer): string {
  if (process.platform !== 'win32' || isUtf8(bytes)) return bytes.toString('utf8')
  return Array.from(bytes, b => b < 0x80 ? String.fromCharCode(b) : CP850[b - 0x80]).join('')
}

/** Splits a stream into lines at the bytes, so a line is decoded whole (a character cut between two chunks survives) */
export function lineReader(onLine: (line: string) => void) {
  let rest = Buffer.alloc(0)
  const emit = (bytes: Buffer) => {
    const clean = stripAnsi(decodeLine(bytes)).replace(/\r/g, '').trimEnd()
    if (clean.trim()) onLine(clean)
  }
  return {
    write(data: Buffer) {
      let buf = Buffer.concat([rest, data]), at: number
      // \n ends a line, and so does a lone \r (a progress bar redrawn in place)
      while ((at = buf.findIndex((b, i) => b === 0x0a || (b === 0x0d && i + 1 < buf.length && buf[i + 1] !== 0x0a))) >= 0) {
        emit(buf.subarray(0, at))
        buf = buf.subarray(at + 1)
      }
      rest = buf
    },
    end() { if (rest.length) emit(rest); rest = Buffer.alloc(0) }
  }
}

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

    const lines = lineCollapser((text, type) => this._emit(options.onLog, taskId, type, text))
    const out = lineReader(text => lines.push(text, 'stdout'))
    const err = lineReader(text => lines.push(text, 'stderr'))
    child.stdout?.on('data', (data: Buffer) => out.write(data))
    child.stderr?.on('data', (data: Buffer) => err.write(data))

    child.on('close', (code: number | null) => {
      out.end(); err.end()
      lines.end()
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
