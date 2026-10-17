import { exec } from 'child_process'

/**
 * Run a shell command without blocking the main process.
 * Resolves with stdout, rejects on non-zero exit, timeout or spawn error.
 * Goes through the shell so Windows .cmd shims (npm, pnpm, yarn) resolve.
 */
export function run(command: string, opts: { cwd?: string; timeout?: number } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { cwd: opts.cwd, timeout: opts.timeout ?? 5000, windowsHide: true, encoding: 'utf-8', maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => (err ? reject(err) : resolve(stdout))
    )
  })
}
