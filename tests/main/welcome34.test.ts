import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { Framework, ProjectSetup } from '../../src/shared/types'
import { planSetup } from '../../src/shared/lib/projectSetup'
import { welcomeFiles, welcomeItems, type WelcomeInfo } from '../../src/shared/lib/welcomePage'
import { tempDir } from '../helpers'

/** v3.4 lot 1: DevForge's welcome page in each created project */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'postgres', dbName: 'shop', dbPort: 5433, features: ['api', 'auth'], git: true, github: null, openVSCode: false, welcome: true, ...s
})
const info = (framework: Framework, s: Partial<ProjectSetup> = {}): WelcomeInfo => ({ name: 'shop', framework, setup: setup(s), tailwind: false, lang: 'fr' })
const ctx = { password: 'pw', secret: 'sec', lang: 'fr' as const, composeName: '' }
const opts = (framework: Framework, s: Partial<ProjectSetup> = {}) => ({ name: 'shop', framework, packageManager: 'npm' as const, typescript: true, eslint: true, setup: setup(s) })

/** TSX the way Next.js and Vite read it: no syntax error */
function tsxErrors(source: string): string[] {
  const out = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 }, fileName: 'page.tsx' })
  return (out.diagnostics ?? []).map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

const hasPhp = (() => { try { execFileSync('php', ['-v'], { stdio: 'ignore' }); return true } catch { return false } })()

describe('v3.4: welcome page', () => {
  it('lists what the creation set up', () => {
    expect(welcomeItems(info('nextjs'))).toEqual(['Base PostgreSQL (Docker)', 'Première route d\'API', 'Connexion et inscription', 'Dépôt Git (branche main)'])
    expect(welcomeItems(info('react', { database: 'none', features: [], git: false }))).toEqual(['Le projet de base, prêt à recevoir votre code'])
  })

  it('writes valid TSX for Next.js and React, with the health link when there is an API', () => {
    const [next] = welcomeFiles(info('nextjs'), true)
    expect(next.path).toBe('{app}/page.tsx')
    expect(tsxErrors(next.content)).toEqual([])
    expect(next.content).toContain('href="/api/health"')
    expect(next.content).not.toMatch(/[^&]'[^']*<\/li>/) // apostrophes escaped (Next's lint refuses them in JSX)
    const [react] = welcomeFiles(info('react', { features: [] }), true)
    expect(react.path).toBe('src/App.tsx')
    expect(tsxErrors(react.content)).toEqual([])
    expect(react.content).not.toContain('/api/health')
  })

  it('writes a Vue component, a Laravel view on /up, and a Node server that runs', () => {
    expect(welcomeFiles(info('vue'), true)[0]).toMatchObject({ path: 'src/App.vue', content: expect.stringContaining('<template>') })
    expect(welcomeFiles(info('laravel'), true)[0]).toMatchObject({ path: 'resources/views/welcome.blade.php', content: expect.stringContaining('href="/up"') })
    const [node] = welcomeFiles(info('nodejs', { database: 'none', features: [] }), true)
    const file = join(tempDir('welcome'), 'index.js')
    writeFileSync(file, node.content)
    expect(() => execFileSync(process.execPath, ['--check', file])).not.toThrow()
  })

  it.runIf(hasPhp)('writes a Symfony controller PHP accepts', () => {
    const [ctrl] = welcomeFiles(info('symfony'), true)
    expect(ctrl.path).toBe('src/Controller/HomeController.php')
    const file = join(tempDir('welcome'), 'HomeController.php')
    writeFileSync(file, ctrl.content)
    expect(execFileSync('php', ['-l', file]).toString()).toContain('No syntax errors')
  })

  it('is a step of the plan only when chosen, and replaces Node\'s plain entry file', () => {
    const withPage = planSetup(opts('nodejs', { welcome: true }), ctx)
    const written = withPage.flatMap(s => s.kind === 'write' ? s.files.map(f => f.path) : [])
    expect(written.filter(p => p === 'index.js')).toHaveLength(1)
    expect(withPage.find(s => s.kind === 'write' && s.label === 'Page d\'accueil DevForge')).toBeTruthy()
    expect(planSetup(opts('nextjs', { welcome: false }), ctx).some(s => s.kind === 'write' && s.label === 'Page d\'accueil DevForge')).toBe(false)
  })
})
