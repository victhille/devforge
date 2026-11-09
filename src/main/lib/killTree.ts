import { execFile, execFileSync, type ChildProcess } from 'child_process'

type Live = ChildProcess & { pid: number }

// Ended by a signal: exitCode stays null, and its pid may already be another process's
const isLive = (child: ChildProcess): child is Live => child.exitCode === null && child.signalCode === null && child.pid !== undefined

const taskkillArgs = (pids: number[]) => [...pids.flatMap(pid => ['/PID', String(pid)]), '/T', '/F']

/** Unix: the child was started detached, so its pid is the group of the whole tree */
function signalTree(child: Live): void {
  try { process.kill(-child.pid, 'SIGTERM') } catch { child.kill('SIGTERM') }
}

/**
 * Kill a process and all its children. With `shell: true` the direct child is
 * the shell, so a plain kill() would leave npm / vite / php running.
 */
export function killTree(child: ChildProcess): Promise<void> {
  return new Promise(resolve => {
    if (!isLive(child)) return resolve()
    if (process.platform === 'win32') {
      execFile('taskkill', taskkillArgs([child.pid]), { windowsHide: true }, () => resolve())
    } else {
      signalTree(child)
      resolve()
    }
  })
}

/**
 * The same for several processes, done before returning: for quitting. On Windows
 * an async taskkill dies with DevForge, then only the shell goes (with the app)
 * and its children (`docker logs -f`, a dev server…) keep running, orphaned.
 */
export function killTreesSync(children: ChildProcess[]): void {
  const live = children.filter(isLive)
  if (!live.length) return
  if (process.platform !== 'win32') return live.forEach(signalTree)
  try {
    execFileSync('taskkill', taskkillArgs(live.map(c => c.pid)), { windowsHide: true, stdio: 'ignore', timeout: 10_000 })
  } catch { /* one already gone fails the whole call, the others are killed all the same */ }
}
