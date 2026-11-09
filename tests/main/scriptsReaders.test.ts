import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Project } from '@shared/types'
import { scriptsOf } from '../../src/main/services/projects/projectScripts'
import { planAction } from '../../src/main/services/assistant/assistantActions'
import { projectContext } from '../../src/main/services/assistant/projectContext'
import { explicitPort } from '../../src/main/services/suggest/suggestions'
import { loadProjects } from '../../src/main/services/projects/projectStorage'
import { loadSettings } from '../../src/main/services/settings/settingsService'
import { tempDir, userData } from '../helpers'

/** Forgy, its project context and the port suggestions read the scripts as the window does (projectScripts) */

const SCRIPTS = { dev: 'vite --port 5174', 'build:prod': 'vite build', 'dev & calc': 'x', 'dev\rcalc': 'x', odd: 42 }

/** A saved project with this package.json (text as is, or an object) */
function project(pkg: unknown, packageManager = 'npm'): Project {
  const dir = join(tempDir(), 'shop')
  mkdirSync(dir)
  writeFileSync(join(dir, 'package.json'), typeof pkg === 'string' ? pkg : JSON.stringify(pkg))
  const p = { id: 'p1', name: 'shop', path: dir, type: 'node', framework: 'vite', packageManager, favorite: false, createdAt: '', lastOpened: null }
  writeFileSync(join(userData(), 'projects.json'), JSON.stringify([p]))
  return p as unknown as Project
}

describe('scriptsOf', () => {
  it('keeps the scripts with a plain name and a text command', () => {
    expect(scriptsOf({ scripts: SCRIPTS })).toEqual({ dev: 'vite --port 5174', 'build:prod': 'vite build' })
  })
  it.each([null, 42, 'x', [], { scripts: ['dev'] }, { scripts: 'dev' }, { name: 'x' }])('gives nothing for %j', pkg => {
    expect(scriptsOf(pkg)).toEqual({})
  })
  it('leaves out a name pnpm reads as a pattern or an option, and an empty command', () => {
    // { "/x/": "" } made « pnpm run /x/ » run every script matching x, commands the card never showed
    expect(scriptsOf({ scripts: { '/x/': '', '/./': 'echo', '-x': 'echo', blank: '  ', empty: '', 'x-run': 'echo', 'lib/build': 'tsc' } }))
      .toEqual({ 'x-run': 'echo', 'lib/build': 'tsc' })
  })
})

describe('the default package manager in the settings', () => {
  it('is a known one, even from an imported file: it goes into the new projects\' commands', () => {
    writeFileSync(join(userData(), 'settings.json'), JSON.stringify({ defaultPackageManager: 'npm & calc &' }))
    expect(loadSettings().defaultPackageManager).toBe('npm')
    writeFileSync(join(userData(), 'settings.json'), JSON.stringify({ defaultPackageManager: 'yarn' }))
    expect(loadSettings().defaultPackageManager).toBe('yarn')
  })
})

describe('the saved projects', () => {
  it('keep a known package manager only: it goes into commands', () => {
    const dir = tempDir()
    const base = { type: 'node', framework: 'vite', favorite: false, createdAt: '', lastOpened: null }
    writeFileSync(join(userData(), 'projects.json'), JSON.stringify([
      { ...base, id: 'a', name: 'a', path: dir, packageManager: 'pnpm' },
      { ...base, id: 'b', name: 'b', path: dir, packageManager: 'calc &' },
      { ...base, id: 'c', name: 'c', path: dir },
      // A broken entry is left out, not the whole list
      null
    ]))
    expect(loadProjects().map(p => p.packageManager)).toEqual(['pnpm', 'npm', 'npm'])
  })
})

describe('Forgy runs a script', () => {
  const plan = (script: string) => planAction('run_script', { project: 'shop', script })

  it('proposes a real script of the package.json', async () => {
    project({ scripts: SCRIPTS })
    expect((await plan('dev')).preview).toBe('npm run dev\nvite --port 5174')
  })

  it('refuses a name a shell would read, even written in the package.json, and one every object has', async () => {
    project({ scripts: SCRIPTS })
    await expect(plan('dev & calc')).rejects.toThrow('No "dev & calc" script')
    await expect(plan('dev\rcalc')).rejects.toThrow('script')
    await expect(plan('toString')).rejects.toThrow('No "toString" script')
    await expect(plan('constructor')).rejects.toThrow('No "constructor" script')
  })

  it('starts a dev server alone in auto-safe mode; any other script waits for a click', async () => {
    project({ scripts: { ...SCRIPTS, start: 'node server.js', watch: 'tsc -w', deploy: 'vercel --prod', publish: 'npm publish' } })
    for (const script of ['dev', 'start', 'watch']) expect(await plan(script)).toMatchObject({ safe: true, reversible: true })
    for (const script of ['build:prod', 'deploy', 'publish']) expect(await plan(script)).toMatchObject({ safe: false, reversible: false })
  })

  it('a dev server with a pre or post script, or with commands chained in it, waits for a click too', async () => {
    project({ scripts: { dev: 'vite', predev: 'node seed.js', start: 'prisma migrate deploy && node server.js', serve: 'vite preview; rm x' } })
    const dev = await plan('dev')
    expect(dev).toMatchObject({ safe: false, reversible: false })
    // npm runs predev with it: the card shows it
    expect(dev.preview).toBe('npm run dev\nvite\npredev: node seed.js')
    for (const script of ['start', 'serve']) expect(await plan(script)).toMatchObject({ safe: false, reversible: false })
  })

  it('a dev server that runs other scripts or writes into a file waits for a click', async () => {
    project({ scripts: { dev: 'npm run deploy', start: 'run-s db:reset serve', serve: 'vite > package.json', watch: 'concurrently a b' } })
    for (const script of ['dev', 'start', 'serve', 'watch']) expect(await plan(script)).toMatchObject({ safe: false, reversible: false })
    project({ scripts: { dev: 'next dev --turbopack', start: 'node server.js' } })
    for (const script of ['dev', 'start']) expect(await plan(script)).toMatchObject({ safe: true, reversible: true })
  })

  it('names only a known package manager', async () => {
    project({ scripts: SCRIPTS }, 'pnpm')
    expect((await plan('dev')).preview).toBe('pnpm run dev\nvite --port 5174')
    project({ scripts: SCRIPTS }, 'npm & calc')
    expect((await plan('dev')).preview).toBe('npm run dev\nvite --port 5174')
  })
})

describe('the project context given to Forgy', () => {
  it('lists the scripts Forgy can run', async () => {
    const text = await projectContext(project({ scripts: SCRIPTS, dependencies: { vite: '^6' } }))
    expect(text).toContain('package.json scripts: {"dev":"vite --port 5174","build:prod":"vite build"}')
    expect(text).toContain('dependencies: vite')
  })
})

describe('the port written in a project', () => {
  it('is read from the dev script', async () => {
    expect(await explicitPort(project({ scripts: SCRIPTS }), {})).toEqual([5174, 'package.json script'])
  })
  it('a package.json that is not JSON gives no port instead of failing', async () => {
    await expect(explicitPort(project('{ not json'), {})).resolves.toBeNull()
  })
})
