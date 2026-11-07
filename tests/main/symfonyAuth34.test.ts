import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'
import type { ProjectSetup, SetupStep } from '../../src/shared/types'
import { AUTH_ROUTES } from '../../src/shared/data/authContract'
import { planSetup, stepCommand } from '../../src/shared/lib/projectSetup'
import { symfonyAuthFiles } from '../../src/shared/lib/symfonyAuthTemplate'
import { tempDir } from '../helpers'

/** v3.4 lot 5: authentication of a Symfony project, on the shared contract */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'postgres', dbName: 'shop', dbPort: 5433, features: ['auth'], git: false, github: null, openVSCode: false, ...s
})
const ctx = { password: 'pw', secret: 's', lang: 'fr' as const, composeName: 'shop-a1b2c3' }
const plan = (s: Partial<ProjectSetup> = {}) => planSetup({ name: 'shop', framework: 'symfony', packageManager: 'npm', typescript: true, eslint: true, setup: setup(s) }, ctx)
const line = (step: SetupStep) => step.kind === 'run' ? stepCommand(step) : `${step.kind}:${step.label}`
const hasPhp = (() => { try { execFileSync('php', ['-v'], { stdio: 'ignore' }); return true } catch { return false } })()

describe('v3.4: Symfony authentication', () => {
  const files = symfonyAuthFiles('shop', 'fr')
  const file = (p: string) => files.find(f => f.path === p)!.content

  it.runIf(hasPhp)('writes PHP files PHP accepts', () => {
    const dir = tempDir('symfony')
    for (const f of files.filter(f => f.path.endsWith('.php'))) {
      const path = join(dir, f.path)
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, f.content)
      expect(execFileSync('php', ['-l', path]).toString(), f.path).toContain('No syntax errors')
    }
  })

  it('writes a security.yaml with the pages\' firewall and a stateless one for the API', () => {
    const yaml = load(file('config/packages/security.yaml')) as { security: { firewalls: Record<string, Record<string, unknown>>; access_control: { path: string }[] } }
    const { firewalls } = yaml.security
    expect(Object.keys(firewalls)).toEqual(['dev', 'api', 'main'])
    expect(firewalls.api).toMatchObject({ stateless: true, access_token: { token_handler: 'App\\Security\\AccessTokenHandler' } })
    expect(firewalls.main).toMatchObject({ form_login: { login_path: 'app_login', enable_csrf: true } })
    expect(yaml.security.access_control.map(a => a.path)).toEqual(['^/dashboard', '^/api/auth/(logout|me)$'])
  })

  it('answers every route of the contract under /api/auth', () => {
    const api = file('src/Controller/Api/AuthController.php')
    expect(api).toContain("#[Route('/api/auth')]")
    for (const [name, route] of Object.entries(AUTH_ROUTES)) {
      expect(api, name).toContain(`#[Route('/${name}', methods: ['${route.method}'])]`)
    }
    expect(api).toContain("$this->json(['user' => $user->toPublic()], 201)")
    expect(file('src/Entity/User.php')).toContain("return ['id' => $this->id, 'name' => $this->name, 'email' => $this->email];")
    expect(file('src/Security/AuthRules.php')).toContain('mb_strlen($data[\'password\']) < 8')
  })

  it('writes Twig pages with CSRF, and no Twig tag hidden in their CSS', () => {
    expect(file('templates/security/login.html.twig')).toContain("csrf_token('authenticate')")
    expect(file('templates/security/register.html.twig')).toContain("csrf_token('register')")
    const layout = file('templates/security/layout.html.twig')
    const css = layout.slice(layout.indexOf('<style>'), layout.indexOf('</style>'))
    expect(css).not.toMatch(/\{[{%#]/)
  })

  it('writes its own User instead of make:user, and migrates once the database runs', () => {
    const steps = plan().map(line)
    expect(steps.some(s => s.includes('make:user'))).toBe(false)
    expect(steps).toContain('composer require symfony/twig-bundle')
    const at = (needle: string) => steps.findIndex(s => s.includes(needle))
    expect(at('make:migration')).toBeGreaterThan(at('docker compose up -d --wait database'))
    expect(at('doctrine:migrations:migrate')).toBeGreaterThan(at('make:migration'))
    // Authentication without a database: SQLite, and the same migration
    expect(plan({ database: 'none' }).map(line)).toContain('php bin/console doctrine:migrations:migrate --no-interaction')
  })
})
