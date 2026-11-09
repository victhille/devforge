import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { ipcMain, type BrowserWindow } from 'electron'
import { registerProjectHandlers } from '../../src/main/ipc/projects'
import { tempDir } from '../helpers'

/** The scripts are read (scripts:get) and run (scripts:run) only once the folder is checked */
type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: Handler) => { handlers.set(channel, fn) }) as never)
registerProjectHandlers({ webContents: { send: () => {} } } as unknown as BrowserWindow)

const scripts = async (path: unknown) => handlers.get('scripts:get')!({}, path)
const project = (pkg: unknown, name = 'app') => {
  const dir = join(tempDir(), name)
  mkdirSync(dir)
  writeFileSync(join(dir, 'package.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg))
  return dir
}

describe('scripts:get', () => {
  it('gives the scripts of a project folder', async () => {
    const dir = project({ scripts: { dev: 'vite', build: 'vite build' } })
    await expect(scripts(dir)).resolves.toEqual({ dev: 'vite', build: 'vite build' })
  })

  it('gives nothing without a package.json, with an unreadable one or without scripts', async () => {
    await expect(scripts(tempDir())).resolves.toEqual({})
    await expect(scripts(project('{ not json'))).resolves.toEqual({})
    await expect(scripts(project({ name: 'x' }))).resolves.toEqual({})
    await expect(scripts(project({ scripts: ['dev'] }))).resolves.toEqual({})
  })

  it('only sends the scripts with a plain name and a text command (a name is typed into the terminal)', async () => {
    const dir = project({ scripts: { dev: 'vite', 'build:prod': 'vite build', odd: 42, nested: { a: 1 }, 'dev;calc': 'x', 'dev\rcalc': 'x', 'a b': 'x' } })
    await expect(scripts(dir)).resolves.toEqual({ dev: 'vite', 'build:prod': 'vite build' })
  })

  it('refuses a network share that is not a saved project, before reaching it', async () => {
    // The terminal's folder comes from what the shell prints: \\host\share would send the Windows login there
    for (const share of ['\\\\attacker.example\\x', '//attacker.example/x', '\\\\?\\UNC\\attacker.example\\x']) {
      await expect(scripts(share)).rejects.toThrow('Network folder refused')
    }
  })

  it('refuses what is not an existing absolute folder, or holds characters a shell reads', async () => {
    const dir = project({ scripts: { dev: 'vite' } })
    await expect(scripts(undefined)).rejects.toThrow()
    await expect(scripts(42)).rejects.toThrow()
    await expect(scripts('relative/app')).rejects.toThrow()
    await expect(scripts(join(dir, 'package.json'))).rejects.toThrow()
    await expect(scripts(join(dir, 'missing'))).rejects.toThrow()
    await expect(scripts(project({ scripts: { dev: 'vite' } }, 'R&D'))).rejects.toThrow()
  })
})

describe('scripts:run', () => {
  const run = async (path: unknown, script: unknown) => handlers.get('scripts:run')!({}, path, script, 'npm')

  it('only runs a script of the package.json, in a checked folder', async () => {
    const dir = project({ scripts: { dev: 'vite' } })
    // What every object has is not a script of this package.json
    await expect(run(dir, 'toString')).rejects.toThrow('Unknown script')
    await expect(run(dir, 'build')).rejects.toThrow('Unknown script')
    await expect(run(dir, 'dev & calc')).rejects.toThrow('Invalid script name')
    await expect(run('\\\\attacker.example\\x', 'dev')).rejects.toThrow('Network folder refused')
    await expect(run(tempDir(), 'dev')).rejects.toThrow('Unknown script')
  })
})

describe('scripts:needs-install and scripts:install', () => {
  it('refuse a network share that is not a saved project', async () => {
    await expect(handlers.get('scripts:needs-install')!({}, '\\\\attacker.example\\x')).rejects.toThrow('Network folder refused')
    await expect(handlers.get('scripts:install')!({}, '\\\\attacker.example\\x', 'npm')).rejects.toThrow('Network folder refused')
  })
})
