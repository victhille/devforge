import { execFile, type ChildProcess } from 'child_process'

/**
 * Kill a process and all its children. With `shell: true` the direct child is
 * the shell, so a plain kill() would leave npm / vite / php running.
 */
export function killTree(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (child.exitCode !== null || child.pid === undefined) return resolve()
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve())
    } else {
      try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
      resolve()
    }
  })
}
