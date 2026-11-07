import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
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
    expect(react.path).toBe('src/pages/Home.tsx')
    expect(react.content).toContain("import '../styles/devforge.css'")
    expect(tsxErrors(react.content)).toEqual([])
    expect(react.content).not.toContain('/api/health')
  })

  it('writes a Vue page, a Laravel view on /up, and no page for Node', () => {
    expect(welcomeFiles(info('vue'), true).map(f => f.path)).toEqual(['src/pages/Home.vue', 'src/App.vue', 'src/styles/devforge.css'])
    expect(welcomeFiles(info('laravel'), true)[0]).toMatchObject({ path: 'resources/views/welcome.blade.php', content: expect.stringContaining('href="/up"') })
    expect(welcomeFiles(info('nodejs'), true)).toEqual([])
  })

  it('knows who is signed in: Twig app.user, Blade @auth, AccountNav for the TypeScript fronts', () => {
    expect(welcomeFiles(info('symfony'), true)[1].content).toContain('{% if app.user %}')
    expect(welcomeFiles(info('laravel'), true)[0].content).toContain('@auth')
    for (const fw of ['nextjs', 'react'] as const) expect(welcomeFiles(info(fw), true)[0].content).toContain('<AccountNav />')
    // Next.js in JavaScript keeps Auth.js: plain links
    expect(welcomeFiles(info('nextjs'), false)[0].content).not.toContain('AccountNav')
    // The views hold no style: the look is devforge.css
    for (const fw of ['nextjs', 'react', 'vue', 'symfony', 'laravel'] as const) {
      for (const file of welcomeFiles(info(fw), true).filter(f => !f.path.endsWith('.css'))) expect(file.content, file.path).not.toMatch(/<style|style=/)
    }
  })

  it.runIf(hasPhp)('writes a Symfony controller PHP accepts', () => {
    const [ctrl, view] = welcomeFiles(info('symfony'), true)
    expect(ctrl.path).toBe('src/Controller/HomeController.php')
    expect(ctrl.content).toContain("$this->render('home/index.html.twig')")
    expect(ctrl.content).not.toContain('<html')
    expect(view.path).toBe('templates/home/index.html.twig')
    const file = join(tempDir('welcome'), 'HomeController.php')
    writeFileSync(file, ctrl.content)
    expect(execFileSync('php', ['-l', file]).toString()).toContain('No syntax errors')
  })

  it('Node: a plain index.js and an npm test checking it answers', () => {
    const steps = planSetup(opts('nodejs', { welcome: true, database: 'none', features: [] }), ctx)
    const dir = tempDir('welcome')
    for (const file of steps.flatMap(s => s.kind === 'write' ? s.files : [])) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true })
      writeFileSync(join(dir, file.path), file.content)
    }
    expect(execFileSync(process.execPath, ['--test'], { cwd: dir }).toString()).toMatch(/pass 1/)
  })

  it('is a step of the plan only when chosen', () => {
    expect(planSetup(opts('react', { welcome: true }), ctx).find(s => s.kind === 'write' && s.label === 'Page d\'accueil DevForge')).toBeTruthy()
    expect(planSetup(opts('nextjs', { welcome: false }), ctx).some(s => s.kind === 'write' && s.label === 'Page d\'accueil DevForge')).toBe(false)
  })
})
