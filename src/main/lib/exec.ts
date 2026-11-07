import { exec, execFile } from 'child_process'

interface RunOptions { cwd?: string; timeout?: number; env?: Record<string, string> }

const execOptions = (opts: RunOptions) => ({
  cwd: opts.cwd,
  env: opts.env ? { ...process.env, ...opts.env } : undefined,
  timeout: opts.timeout ?? 5000,
  windowsHide: true,
  encoding: 'utf-8' as const,
  maxBuffer: 16 * 1024 * 1024
})

/**
 * Run a shell command without blocking the main process.
 * Resolves with stdout, rejects on non-zero exit, timeout or spawn error.
 * Goes through the shell so Windows .cmd shims (npm, pnpm, yarn) resolve.
 */
export function run(command: string, opts: RunOptions = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, execOptions(opts), (err, stdout) => (err ? reject(err) : resolve(stdout)))
  })
}

export interface CaptureResult { ok: boolean; stdout: string; stderr: string }

/** Like `run` but never rejects: returns exit status with both streams. */
export function runCapture(command: string, opts: RunOptions = {}): Promise<CaptureResult> {
  return new Promise(resolve => {
    exec(command, execOptions(opts), (err, stdout, stderr) =>
      resolve({ ok: !err, stdout: stdout ?? '', stderr: (stderr ?? '') || (err && !stdout ? err.message : '') })
    )
  })
}

/** Quote an argument for the platform shell. */
export function quote(arg: string): string {
  if (process.platform === 'win32') return `"${arg.replace(/"/g, '""')}"`
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

/**
 * Run an executable with an argument array, no shell involved:
 * no quoting or `%` expansion issues. Only for real binaries (git, docker…).
 */
export function runFile(file: string, args: string[], opts: RunOptions = {}): Promise<CaptureResult> {
  return new Promise(resolve => {
    execFile(file, args, execOptions(opts), (err, stdout, stderr) =>
      resolve({ ok: !err, stdout: stdout ?? '', stderr: (stderr ?? '') || (err && !stdout ? err.message : '') })
    )
  })
}
