import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Framework, ProjectCreationOptions, ProjectSetup, SetupStep } from '../../src/shared/types'
import { ignoreLines, planSetup, prismaClientFile, stepCommand } from '../../src/shared/lib/projectSetup'
import { packageName } from '../../src/shared/data/projectLibraries'
import { runSetup, withVitePlugin } from '../../src/main/services/projects/projectSetup'
import { tempDir } from '../helpers'

/** v3.3.1: what the creation tests on real projects turned up (Node, React, Next.js, Laravel) */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'none', dbName: 'boutique', dbPort: 5433, features: [], git: true, github: null, openVSCode: false, ...s
})
const opts = (framework: Framework, s: Partial<ProjectSetup> = {}, extra: Partial<ProjectCreationOptions> = {}) => ({
  name: 'boutique', framework, packageManager: 'npm' as const, typescript: true, eslint: true, setup: setup(s), ...extra
})
const ctx = { password: 'pw', secret: 'sec', lang: 'fr' as const, composeName: 'boutique-a1b2c3' }
const commands = (steps: SetupStep[]) => steps.map(s => s.kind === 'run' ? stepCommand(s) : s.kind)

describe('v3.3.1: creation plan', () => {
  it('Node: an entry file, dev and start scripts, node_modules ignored before the first commit', () => {
    const steps = planSetup(opts('nodejs'), ctx)
    expect(steps.find(s => s.kind === 'write')).toMatchObject({ files: [{ path: 'index.js' }] })
    expect(steps.find(s => s.kind === 'scripts')).toMatchObject({ scripts: { start: 'node index.js', dev: 'node --watch index.js' } })
    const cmds = commands(steps)
    expect(cmds.indexOf('ignore')).toBeLessThan(cmds.indexOf('git add -A'))
    expect(steps.find(s => s.kind === 'ignore')).toMatchObject({ lines: expect.arrayContaining(['/node_modules', '.env']) })
    expect(cmds).not.toContain('npm install')
  })

  it('Node with Prisma: init without the agent skills, client ignored', () => {
    const cmds = commands(planSetup(opts('nodejs', {}, { libraries: ['@prisma/client@7'], devLibraries: ['prisma@7'] }), ctx))
    expect(cmds).toContain('npx prisma init --datasource-provider postgresql --output ../generated/prisma --no-skills')
  })

  it('installs the dependencies a template leaves out (Laravel, Vite), only when package.json is there', () => {
    const step = planSetup(opts('laravel'), ctx)[0]
    expect(step).toMatchObject({ kind: 'run', exe: 'npm', args: ['install'], skipIf: 'node_modules', onlyIf: 'package.json' })
    expect(ignoreLines('laravel')).toEqual(['/vendor', '/node_modules'])
    expect(ignoreLines('empty')).toEqual([])
  })

  it('Tailwind 4: Vite plugin for React and Vue, PostCSS for Next.js', () => {
    const react = planSetup(opts('react', {}, { devLibraries: ['tailwindcss'] }), ctx)
    expect(commands(react)).toContain('npm install --save-dev @tailwindcss/vite')
    expect(react.find(s => s.kind === 'tailwind')).toMatchObject({ via: 'vite' })
    const next = planSetup(opts('nextjs', {}, { devLibraries: ['tailwindcss'] }), ctx)
    expect(next.find(s => s.kind === 'run' && s.label.includes('Tailwind'))).toMatchObject({ skipIf: 'node_modules/@tailwindcss/postcss' })
    expect(next.find(s => s.kind === 'tailwind')).toMatchObject({ via: 'postcss' })
    expect(planSetup(opts('react'), ctx).some(s => s.kind === 'tailwind')).toBe(false)
  })

  it('Next.js + Postgres: Prisma 7 with its adapter, a client file, the generated client ignored', () => {
    const steps = planSetup(opts('nextjs', { database: 'postgres' }), ctx)
    const cmds = commands(steps)
    expect(cmds).toContain('npm install @prisma/adapter-pg@7 pg')
    expect(cmds).toContain('npx prisma init --datasource-provider postgresql --output ../{src}generated/prisma --no-skills')
    expect(steps.some(s => s.kind === 'ignore' && s.lines.includes('/{src}generated/prisma'))).toBe(true)
    expect(steps.find(s => s.kind === 'write' && s.files[0].path === '{src}lib/prisma.ts')).toBeTruthy()
    const file = prismaClientFile('postgres', true)
    expect(file).toContain("from '../generated/prisma/client'")
    expect(file).toContain('new PrismaPg({ connectionString: process.env.DATABASE_URL })')
    expect(prismaClientFile('sqlite', false)).not.toContain('DATABASE_URL!')
  })

  it('reads package names out of versioned specs', () => {
    expect(packageName('@prisma/client@7')).toBe('@prisma/client')
    expect(packageName('prisma@7')).toBe('prisma')
    expect(packageName('tailwindcss')).toBe('tailwindcss')
  })
})

describe('v3.3.1: Tailwind wired in', () => {
  it('adds the Vite plugin to the config once', () => {
    const config = "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n"
    const out = withVitePlugin(config)
    expect(out).toContain("import react from '@vitejs/plugin-react'\nimport tailwindcss from '@tailwindcss/vite'\n")
    expect(out).toContain('plugins: [tailwindcss(), react()]')
    expect(withVitePlugin(out)).toBe(out)
    expect(() => withVitePlugin('export default {}')).toThrow()
  })

  it('sets up a Vite React project and resolves the paths in the log', async () => {
    const dir = tempDir('react')
    mkdirSync(join(dir, 'node_modules/@tailwindcss/vite'), { recursive: true })
    mkdirSync(join(dir, 'src'))
    writeFileSync(join(dir, 'vite.config.ts'), "import react from '@vitejs/plugin-react'\nexport default { plugins: [react()] }\n")
    writeFileSync(join(dir, 'src/index.css'), ':root { color: red; }\n')
    const options = { ...opts('react', { git: false }, { devLibraries: ['tailwindcss'] }), destination: dir, installDeps: false, initGit: false, openAfter: false } as ProjectCreationOptions
    const lines: string[] = []
    const result = await new Promise<string>(resolve => runSetup(options, dir, 't1', l => lines.push(l.text), r => resolve(r.status)))
    expect(result).toBe('success')
    expect(readFileSync(join(dir, 'vite.config.ts'), 'utf-8')).toContain('plugins: [tailwindcss(), react()]')
    expect(readFileSync(join(dir, 'src/index.css'), 'utf-8')).toBe('@import "tailwindcss";\n\n:root { color: red; }\n')
    expect(lines.some(l => l.includes('déjà en place'))).toBe(true)
  })

  it('writes postcss.config.mjs when Next.js has none, and never twice', async () => {
    const dir = tempDir('next')
    mkdirSync(join(dir, 'node_modules/@tailwindcss/postcss'), { recursive: true })
    mkdirSync(join(dir, 'src/app'), { recursive: true })
    writeFileSync(join(dir, 'src/app/globals.css'), '@import "tailwindcss";\n')
    const options = { ...opts('nextjs', { git: false, features: ['api'] }, { devLibraries: ['tailwindcss'] }), destination: dir, installDeps: false, initGit: false, openAfter: false } as ProjectCreationOptions
    const lines: string[] = []
    const result = await new Promise<string>(resolve => runSetup(options, dir, 't2', l => lines.push(l.text), r => resolve(r.status)))
    expect(result).toBe('success')
    expect(readFileSync(join(dir, 'postcss.config.mjs'), 'utf-8')).toContain('@tailwindcss/postcss')
    expect(readFileSync(join(dir, 'src/app/globals.css'), 'utf-8')).toBe('@import "tailwindcss";\n')
    // {app} resolved: written in src/app, and the log says so
    expect(existsSync(join(dir, 'src/app/api/health/route.ts'))).toBe(true)
    expect(lines.some(l => l.includes('src/app/api/health/route.ts'))).toBe(true)
    expect(lines.some(l => l.includes('{app}'))).toBe(false)
  })
})
