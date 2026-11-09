import { describe, expect, it } from 'vitest'
import { isLongRunningScript, managerOf, serverScript } from '@shared/lib/packageManagers'

/** The script that starts a project, and the ones Forgy may start without a click */
describe('package manager rules', () => {
  it('picks the script that starts a project: dev, then start, then serve', () => {
    expect(serverScript({ build: 'vite build', serve: 'vite preview', start: 'node .', dev: 'vite' })).toBe('dev')
    expect(serverScript({ serve: 'vite preview', start: 'node .' })).toBe('start')
    expect(serverScript({ serve: 'vite preview' })).toBe('serve')
    expect(serverScript({ build: 'vite build' })).toBeNull()
    // A key every object has is not a script
    expect(serverScript(Object.create({ dev: 'inherited' }) as Record<string, string>)).toBeNull()
  })

  it('a dev server or a watcher only runs until it is stopped; a build, a deploy or a publish acts for good', () => {
    for (const s of ['dev', 'start', 'serve', 'watch']) expect(isLongRunningScript(s)).toBe(true)
    for (const s of ['build', 'deploy', 'publish', 'db:reset', 'dev:build', 'test', 'toString']) expect(isLongRunningScript(s)).toBe(false)
  })

  it('names a known package manager only', () => {
    expect(managerOf('pnpm')).toBe('pnpm')
    expect(managerOf('npm & calc')).toBe('npm')
    expect(managerOf(undefined)).toBe('npm')
  })
})
