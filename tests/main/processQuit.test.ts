import { spawn, type ChildProcess } from 'child_process'
import { chmodSync, writeFileSync } from 'fs'
import { delimiter, join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { killTreesSync } from '../../src/main/lib/killTree'
import { processManager } from '../../src/main/services/stacks/processManager'
import { CommandRunner, commandRunner } from '../../src/main/services/system/commandRunner'
import { stopAllProcessesNow } from '../../src/main/services/system/quitProcesses'
import { lastRun, runTests, testsToKillOnQuit } from '../../src/main/services/tests/testRunner'
import { saveProjects, tempDir } from '../helpers'

/**
 * Quitting DevForge: what it started is killed before it exits, the shell's children too.
 * On Windows they used to survive it (`docker compose logs -f` left running, orphaned).
 */

const node = JSON.stringify(process.execPath)
// A node that says its pid, then waits: run by a shell, a grandchild of DevForge, like `docker logs -f`
const script = "console.log('pid',process.pid);setTimeout(Boolean,600000)"
const waiter = `${node} -e "${script}"`
const pidIn = (text?: string) => Number(text?.match(/^pid (\d+)$/)?.[1] ?? 0)

const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
const until = async (ok: () => boolean) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise(r => setTimeout(r, 50)) }

// Still alive after a test that failed: killed then
const grandchildren: number[] = []
afterEach(() => { for (const pid of grandchildren.splice(0)) if (alive(pid)) process.kill(pid) })

/**
 * Windows: gone as soon as the call returns (an async taskkill would not even have started yet);
 * unix: the signal is sent at once, the process is gone once it is handled and reaped
 */
async function gone(pid: number): Promise<boolean> {
  if (process.platform !== 'win32') await until(() => !alive(pid))
  if (alive(pid)) return false
  // Its pid may be another process's from now on: the cleanup leaves it alone
  const i = grandchildren.indexOf(pid)
  if (i >= 0) grandchildren.splice(i, 1)
  return true
}

/** The waiter's pid, once one of these lines gives it */
async function pidFrom(lines: () => (string | undefined)[]): Promise<number> {
  await until(() => lines().some(l => pidIn(l) > 0))
  const pid = pidIn(lines().find(l => pidIn(l) > 0))
  // Never 0 in the cleanup: process.kill(0) is this process (its whole group on unix)
  expect(pid, 'the waiter never said its pid').toBeGreaterThan(0)
  grandchildren.push(pid)
  return pid
}

/** A shell running the waiter, and the pid of that waiter */
async function shellWithChild(): Promise<{ shell: ChildProcess; pid: number }> {
  const shell = spawn(waiter, { shell: true, windowsHide: true, detached: process.platform !== 'win32' })
  const out: string[] = []
  shell.stdout?.on('data', (d: Buffer) => out.push(d.toString().trim()))
  return { shell, pid: await pidFrom(() => out) }
}

describe('quitting DevForge', () => {
  it('kills the running processes and commands, their children too, before going on', async () => {
    processManager.start('compose:shop', waiter, tempDir('logs'))
    const logs: string[] = []
    commandRunner.run({ executable: node, args: ['-e', `"${script}"`], cwd: tempDir('cmd'), onLog: l => logs.push(l.text), onResult: () => {} })
    const server = await pidFrom(() => processManager.logs('compose:shop').map(l => l.text))
    const command = await pidFrom(() => logs)

    stopAllProcessesNow()
    expect(await gone(server)).toBe(true)
    expect(await gone(command)).toBe(true)
    expect(processManager.list().find(p => p.key === 'compose:shop')?.status).toBe('stopped')
  })

  it('kills a command cancelled right before, then reports nothing and starts nothing more', async () => {
    const runner = new CommandRunner()
    const logs: string[] = []
    const onResult = vi.fn()
    const run = () => runner.run({ executable: node, args: ['-e', `"${script}"`], cwd: tempDir('cmd'), onLog: l => logs.push(l.text), onResult })
    const id = run()
    const pid = await pidFrom(() => logs)

    // Its async taskkill would die with DevForge
    runner.cancel(id)
    killTreesSync(runner.toKillOnQuit())
    expect(await gone(pid)).toBe(true)
    // A step chained to it (create, then install…) would start now: nothing runs
    const logged = logs.length
    expect(runner.getTask(run())).toBeUndefined()
    await new Promise(r => setTimeout(r, 300))
    expect(logs).toHaveLength(logged)
    expect(onResult).not.toHaveBeenCalled()
  })

  it('kills a test run, and does not keep it as the last one', async () => {
    const dir = tempDir('shop')
    saveProjects([{ name: 'Shop', path: dir }])
    // A `go` first on the PATH: `go test -json ./...` runs the waiter
    const bin = tempDir('bin')
    if (process.platform === 'win32') writeFileSync(join(bin, 'go.cmd'), `@${waiter}\r\n`)
    else { writeFileSync(join(bin, 'go'), `#!/bin/sh\nexec ${waiter}\n`); chmodSync(join(bin, 'go'), 0o755) }
    const path = process.env.PATH
    process.env.PATH = `${bin}${delimiter}${path}`
    try {
      const lines: string[] = []
      const run = runTests(dir, 'go', undefined, l => lines.push(l))
      const pid = await pidFrom(() => lines)

      stopAllProcessesNow()
      expect(await gone(pid)).toBe(true)
      expect(await run).toMatchObject({ cancelled: true })
      expect(lastRun(dir, 'go')).toBeNull()
    } finally {
      process.env.PATH = path
    }
  })

  it('kills several trees at once, and skips one that has already ended', async () => {
    const a = await shellWithChild()
    const b = await shellWithChild()
    const done = spawn(`${node} -e "1"`, { shell: true, windowsHide: true })
    await new Promise(resolve => done.once('exit', resolve))

    killTreesSync([a.shell, done, b.shell])
    expect(await gone(a.pid)).toBe(true)
    expect(await gone(b.pid)).toBe(true)
  })

  it('has nothing to do when nothing runs', () => {
    expect(() => killTreesSync([])).not.toThrow()
    expect(testsToKillOnQuit()).toEqual([])
    expect(() => stopAllProcessesNow()).not.toThrow()
  })
})
