import { readFileSync } from 'fs'
import { join } from 'path'
import { shell } from 'electron'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { Stack } from '@shared/types'
import { processManager } from '../../src/main/services/stacks/processManager'
import { assertStack, loadStacks, saveStack, startStep, stopStack } from '../../src/main/services/stacks/stackService'
import { tempDir, userData } from '../helpers'

/** v4.0: the stack launcher, the one place where a saved shell line runs */

const node = JSON.stringify(process.execPath)
const stack = (steps: Stack['steps']): Stack => ({ id: 's1', name: 'Shop', color: 'blue', steps })
const until = async (ok: () => boolean) => { for (let i = 0; i < 100 && !ok(); i++) await new Promise(r => setTimeout(r, 50)) }

afterAll(() => stopStack('s1'))

describe('what the window may save', () => {
  it('keeps a well-formed stack', () => {
    saveStack(stack([{ id: 'api', type: 'command', label: 'API', command: 'npm run dev', cwd: 'C:\\shop' }, { id: 'web', type: 'url', label: 'Site', url: 'http://localhost:5173', delayMs: 2000 }]))
    expect(loadStacks().map(s => s.steps.length)).toEqual([2])
  })

  it('refuses anything else, and keeps nothing of it', () => {
    const bad: unknown[] = [
      null, 'stack', { id: 's2', name: 'x' }, { id: 's2', name: 'x', steps: 'run' },
      stack([{ id: 'a', type: 'powershell' as 'command', label: 'x', command: 'calc' }]),
      stack([{ id: 'a', type: 'command', label: 'x', command: 42 as unknown as string }]),
      stack([{ id: 'a', type: 'command', label: 'x', command: 'x'.repeat(4001) }]),
      stack([{ id: 'a', type: 'url', label: 'x', url: 'http://a', delayMs: -1 }]),
      stack([{ id: 'a', type: 'url', label: 'x', url: 'http://a', delayMs: 3_600_000 }])
    ]
    for (const b of bad) expect(() => saveStack(b as Stack), JSON.stringify(b)?.slice(0, 60)).toThrow(/Invalid stack/)
    expect(() => assertStack(undefined)).toThrow()
    expect(JSON.parse(readFileSync(join(userData(), 'stacks.json'), 'utf-8'))).toHaveLength(1)
  })
})

describe('running a step', () => {
  it('runs the command in its folder and keeps its output', async () => {
    const dir = tempDir('stack')
    saveStack(stack([{ id: 'echo', type: 'command', label: 'Echo', command: `${node} -e "console.log(process.cwd())"`, cwd: dir }]))
    await startStep('s1', 'echo')
    await until(() => processManager.list().find(p => p.key === 's1:echo')?.status === 'exited')
    expect(processManager.list().find(p => p.key === 's1:echo')).toMatchObject({ status: 'exited', exitCode: 0 })
    expect(processManager.logs('s1:echo').some(l => l.stream === 'stdout' && l.text.trim() === dir)).toBe(true)
  })

  it('refuses a folder that does not exist instead of running elsewhere', async () => {
    saveStack(stack([{ id: 'lost', type: 'command', label: 'Lost', command: `${node} -e "1"`, cwd: join(tempDir('gone'), 'missing') }]))
    await expect(startStep('s1', 'lost')).rejects.toThrow(/Not a folder/)
    saveStack(stack([{ id: 'rel', type: 'command', label: 'Relative', command: `${node} -e "1"`, cwd: 'relative\\dir' }]))
    await expect(startStep('s1', 'rel')).rejects.toThrow(/Not a folder/)
    expect(processManager.list().some(p => p.key === 's1:lost' || p.key === 's1:rel')).toBe(false)
  })

  it('stops a long-running process, its children too', async () => {
    saveStack(stack([{ id: 'srv', type: 'command', label: 'Server', command: `${node} -e "setInterval(() => {}, 1000)"`, cwd: tempDir('srv') }]))
    await startStep('s1', 'srv')
    expect(processManager.isRunning('s1:srv')).toBe(true)
    await stopStack('s1')
    expect(processManager.list().find(p => p.key === 's1:srv')?.status).toBe('stopped')
  })

  it('opens only web addresses, never a file or another scheme', async () => {
    const opened = vi.spyOn(shell, 'openExternal')
    for (const url of ['file:///C:/Windows/System32/calc.exe', 'javascript:alert(1)', 'ms-settings:', 'https://example.com/']) {
      saveStack(stack([{ id: 'u', type: 'url', label: 'x', url, delayMs: 0 }]))
      await startStep('s1', 'u')
    }
    await until(() => opened.mock.calls.length > 0)
    expect(opened.mock.calls.map(c => c[0])).toEqual(['https://example.com/'])
  })

  it('refuses an unknown step', async () => {
    expect(() => startStep('s1', 'nope')).toThrow(/Unknown step/)
  })
})
