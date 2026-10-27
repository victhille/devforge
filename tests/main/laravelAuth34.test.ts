import { execFileSync } from 'child_process'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { ProjectSetup, SetupStep } from '../../src/shared/types'
import { AUTH_ROUTES } from '../../src/shared/data/authContract'
import { planSetup, stepCommand } from '../../src/shared/lib/projectSetup'
import { LARAVEL_API_ROUTES, laravelAuthFiles, laravelAuthPatches } from '../../src/shared/lib/laravelAuthTemplate'
import { patchText } from '../../src/main/services/projects/projectSetup'
import { tempDir } from '../helpers'

/** v3.4 lot 4: authentication of a Laravel project, on the shared contract */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'postgres', dbName: 'shop', dbPort: 5433, features: ['auth'], git: false, github: null, openVSCode: false, ...s
})
const ctx = { password: 'pw', secret: 's', lang: 'fr' as const, composeName: 'shop-a1b2c3' }
const plan = (s: Partial<ProjectSetup> = {}) => planSetup({ name: 'shop', framework: 'laravel', packageManager: 'npm', typescript: true, eslint: true, setup: setup(s) }, ctx)
const line = (step: SetupStep) => step.kind === 'run' ? stepCommand(step) : `${step.kind}:${step.label}`
const hasPhp = (() => { try { execFileSync('php', ['-v'], { stdio: 'ignore' }); return true } catch { return false } })()

/** The parts of Fortify's stubs the patches aim at (laravel/fortify 1.41) */
const PROVIDER = `    public function boot(): void
    {
        Fortify::createUsersUsing(CreateNewUser::class);
        Fortify::updateUserProfileInformationUsing(UpdateUserProfileInformation::class);
`
const CONFIG = `    'home' => '/home',\n`

describe('v3.4: Laravel authentication', () => {
  const files = laravelAuthFiles('shop', 'fr')
  const [views, home] = laravelAuthPatches({ views: 'v', home: 'h', routes: 'r' }) as Extract<SetupStep, { kind: 'patch' }>[]

  it.runIf(hasPhp)('writes a controller PHP accepts', () => {
    const file = join(tempDir('laravel'), 'AuthController.php')
    writeFileSync(file, files.find(f => f.path.endsWith('AuthController.php'))!.content)
    expect(execFileSync('php', ['-l', file]).toString()).toContain('No syntax errors')
  })

  it('answers every route of the contract, two of them behind Sanctum', () => {
    for (const [name, route] of Object.entries(AUTH_ROUTES)) {
      expect(LARAVEL_API_ROUTES, name).toContain(`Route::${route.method.toLowerCase()}('${name}'`)
    }
    expect(LARAVEL_API_ROUTES).toMatch(/middleware\('auth:sanctum'\)->group\(function \(\) \{\s+Route::post\('logout'[\s\S]+Route::get\('me'/)
    const ctrl = files.find(f => f.path.endsWith('AuthController.php'))!.content
    expect(ctrl).toContain("'min:8'")
    expect(ctrl).toContain('], 201);')
    expect(ctrl).toContain("['id' => $user->id, 'name' => $user->name, 'email' => $user->email]")
  })

  it('writes the Blade pages, with CSRF, and a layout Blade reads as plain text', () => {
    for (const p of ['auth/login', 'auth/register', 'dashboard']) {
      const view = files.find(f => f.path === `resources/views/${p}.blade.php`)!.content
      expect(view, p).toContain("@extends('layouts.devforge')")
    }
    expect(files.find(f => f.path.endsWith('register.blade.php'))!.content).toContain('name="password_confirmation"')
    expect(files.filter(f => f.path.endsWith('.blade.php') && f.content.includes('method="POST"')).every(f => f.content.includes('@csrf'))).toBe(true)
    // No Blade directive hidden in the CSS (an @media would be harmless, an @if would not)
    const layout = files.find(f => f.path.endsWith('layouts/devforge.blade.php'))!.content
    expect(layout.match(/@\w+/g)).toEqual(['@yield', '@yield'])
  })

  it('registers Fortify\'s views once, and sends a signed-in user to /dashboard', () => {
    const once = patchText(PROVIDER, views)
    expect(once).toContain("Fortify::createUsersUsing(CreateNewUser::class);\n        Fortify::loginView(fn () => view('auth.login'));")
    expect(patchText(once, views)).toBe(once)
    expect(patchText(CONFIG, home)).toBe("    'home' => '/dashboard',\n")
    expect(patchText('no anchor here', views)).toBe('no anchor here')
  })

  it('brings Sanctum with authentication alone, and migrates after the database starts', () => {
    const steps = plan().map(line)
    expect(steps).toContain('php artisan install:api --without-migration-prompt --no-interaction')
    const at = (needle: string) => steps.findIndex(s => s.includes(needle))
    expect(at('patch:')).toBeGreaterThan(at('fortify:install'))
    expect(at('php artisan migrate --force')).toBeGreaterThan(at('docker compose up -d --wait database'))
    // Authentication without a database: SQLite, migrated for Sanctum's and Fortify's tables
    expect(plan({ database: 'none' }).map(line)).toContain('php artisan migrate --force')
  })
})
