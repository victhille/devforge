import { describe, expect, it } from 'vitest'
import type { ProjectSetup } from '../../src/shared/types'
import { AUTH_PAGES, AUTH_ROUTES, AUTH_RULES } from '../../src/shared/data/authContract'
import { planSetup, withAuthDatabase } from '../../src/shared/lib/projectSetup'

/** v3.4 lot 2: one authentication API for every server DevForge creates */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'none', dbName: 'shop', dbPort: 0, features: ['auth'], git: false, github: null, openVSCode: false, ...s
})

describe('v3.4: authentication contract', () => {
  it('names four JSON routes under /api/auth, two of them behind the token', () => {
    expect(Object.values(AUTH_ROUTES).map(r => `${r.method} ${r.path}`)).toEqual([
      'POST /api/auth/register', 'POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/auth/me'
    ])
    expect(Object.entries(AUTH_ROUTES).filter(([, r]) => r.auth).map(([n]) => n)).toEqual(['logout', 'me'])
    expect(AUTH_ROUTES.register.ok).toBe(201)
    expect(AUTH_ROUTES.register.body).toEqual(['name', 'email', 'password'])
    expect(AUTH_RULES.passwordMin).toBe(8)
    expect(AUTH_PAGES).toEqual({ login: '/login', register: '/register', dashboard: '/dashboard' })
  })

  it('gives authentication without a database SQLite, and leaves the rest as chosen', () => {
    expect(withAuthDatabase(setup()).database).toBe('sqlite')
    expect(withAuthDatabase(setup({ database: 'postgres' })).database).toBe('postgres')
    expect(withAuthDatabase(setup({ features: [] })).database).toBe('none')
    // The plan follows: Laravel writes SQLite to its .env, with no Docker step
    const steps = planSetup({ name: 'shop', framework: 'laravel', packageManager: 'npm', typescript: true, eslint: true, setup: setup() }, { password: 'pw', secret: 's', lang: 'fr', composeName: '' })
    expect(steps.find(s => s.kind === 'env' && s.file === '.env')).toMatchObject({ vars: { DB_CONNECTION: 'sqlite' } })
    expect(steps.some(s => s.kind === 'run' && s.exe === 'docker')).toBe(false)
    expect(steps.find(s => s.kind === 'connection')).toMatchObject({ type: 'sqlite', file: 'database/database.sqlite' })
  })
})
