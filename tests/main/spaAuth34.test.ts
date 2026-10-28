import { describe, expect, it } from 'vitest'
import type { ProjectSetup, SetupStep } from '../../src/shared/types'
import { AUTH_ROUTES } from '../../src/shared/data/authContract'
import { planSetup, stepCommand } from '../../src/shared/lib/projectSetup'
import { API_URL_RE, spaAuthFiles } from '../../src/shared/lib/spaAuthTemplate'

/** v3.4 lot 6: a React or Vue front, client of the shared contract (checked by a real `npm run build` of both Vite templates while writing it) */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'none', dbName: '', dbPort: 0, features: ['auth'], git: false, github: null, openVSCode: false, apiUrl: 'http://localhost:3000/', ...s
})
const ctx = { password: 'pw', secret: 's', lang: 'fr' as const, composeName: '' }
const plan = (framework: 'react' | 'vue', s: Partial<ProjectSetup> = {}, typescript = true) =>
  planSetup({ name: 'shop', framework, packageManager: 'npm', typescript, eslint: true, setup: setup(s) }, ctx)
const line = (step: SetupStep) => step.kind === 'run' ? stepCommand(step) : `${step.kind}:${step.kind === 'write' ? step.files.map(f => f.path).join(',') : step.label}`

describe('v3.4: React and Vue authentication', () => {
  it('calls every route of the contract with the token as Bearer', () => {
    const client = spaAuthFiles('react', 'shop', 'fr', 'http://localhost:8000').find(f => f.path === 'src/lib/auth.ts')!.content
    for (const route of Object.values(AUTH_ROUTES)) expect(client, route.path).toContain(`'${route.method}', '${route.path}'`)
    expect(client).toContain('headers.Authorization = `Bearer ${token}`')
    expect(client).toContain("Accept: 'application/json'")
    expect(client).toContain('import.meta.env.VITE_API_URL')
  })

  it('writes the pages, mounts them in place of App and proxies /api to the server', () => {
    const steps = plan('react').map(line)
    expect(steps.some(s => s.includes('src/auth/Root.tsx'))).toBe(true)
    const react = plan('react').filter(s => s.kind === 'patch') as Extract<SetupStep, { kind: 'patch' }>[]
    expect(react.map(p => p.file)).toEqual(['src/main.tsx', 'vite.config.ts'])
    // The address the wizard gave, without its trailing slash
    expect(react[1].text).toContain("'/api': { target: 'http://localhost:3000', changeOrigin: true }")
    const vue = plan('vue').filter(s => s.kind === 'write').flatMap(s => s.kind === 'write' ? s.files.map(f => f.path) : [])
    expect(vue).toEqual(expect.arrayContaining(['src/auth/Root.vue', 'src/auth/AuthForm.vue', 'src/auth/Dashboard.vue']))
  })

  it('keeps no database for a front, and nothing for JavaScript or without the option', () => {
    expect(plan('react').some(s => s.kind === 'connection')).toBe(false)
    expect(plan('react', {}, false).some(s => s.kind === 'patch')).toBe(false)
    expect(plan('vue', { features: [] }).some(s => s.kind === 'patch')).toBe(false)
  })

  it('accepts only a plain http(s) address for vite.config', () => {
    expect(API_URL_RE.test('http://localhost:8000')).toBe(true)
    expect(API_URL_RE.test('https://api.example.com')).toBe(true)
    expect(API_URL_RE.test("http://x' + process.exit() + '")).toBe(false)
    expect(API_URL_RE.test('localhost:8000')).toBe(false)
  })
})
