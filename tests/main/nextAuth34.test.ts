import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import type { ProjectSetup, SetupStep } from '../../src/shared/types'
import { AUTH_PAGES, AUTH_ROUTES } from '../../src/shared/data/authContract'
import { planSetup, stepCommand } from '../../src/shared/lib/projectSetup'
import { USER_MODEL, nextAuthFiles } from '../../src/shared/lib/nextAuthTemplate'

/** v3.4 lot 3: authentication of a Next.js project, on the shared contract */
const setup = (s: Partial<ProjectSetup> = {}): ProjectSetup => ({
  database: 'postgres', dbName: 'shop', dbPort: 5433, features: ['auth'], git: false, github: null, openVSCode: false, ...s
})
const ctx = { password: 'pw', secret: 'c2VjcmV0', lang: 'fr' as const, composeName: 'shop-a1b2c3' }
const plan = (s: Partial<ProjectSetup> = {}, typescript = true) =>
  planSetup({ name: 'shop', framework: 'nextjs', packageManager: 'npm', typescript, eslint: true, setup: setup(s) }, ctx)
const line = (step: SetupStep) => step.kind === 'run' ? stepCommand(step) : `${step.kind}:${step.label}`

function syntaxErrors(path: string, source: string): string[] {
  const out = ts.transpileModule(source, { reportDiagnostics: true, fileName: path, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2022 } })
  return (out.diagnostics ?? []).map(d => `${path}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
}

describe('v3.4: Next.js authentication', () => {
  const files = nextAuthFiles('shop', 'fr')

  it('writes valid TypeScript for every file', () => {
    expect(files.flatMap(f => syntaxErrors(f.path, f.content))).toEqual([])
  })

  it('has one route file per route of the contract, with its method', () => {
    for (const [name, route] of Object.entries(AUTH_ROUTES)) {
      const file = files.find(f => f.path === `{app}${route.path}/route.ts`)
      expect(file, name).toBeTruthy()
      expect(file!.content).toContain(`export async function ${route.method}(`)
    }
    expect(files.find(f => f.path.endsWith('/register/route.ts'))!.content).toContain('{ status: 201 }')
    expect(files.find(f => f.path.endsWith('/logout/route.ts'))!.content).toContain('status: 204')
  })

  it('adds the contract\'s pages, the dashboard redirecting to /login', () => {
    for (const page of Object.values(AUTH_PAGES)) expect(files.some(f => f.path === `{app}${page}/page.tsx`), page).toBe(true)
    const dashboard = files.find(f => f.path === '{app}/dashboard/page.tsx')!.content
    expect(dashboard).toContain("redirect('/login')")
    // Next.js 16 (Cache Components): the cookie is read inside <Suspense>
    expect(dashboard).toContain('<Suspense fallback=')
  })

  it('never returns the password hash, and reads Bearer before the cookie', () => {
    const lib = files.find(f => f.path === '{src}lib/auth.ts')!.content
    expect(lib).toContain('publicUser = (u: PublicUser): PublicUser => ({ id: u.id, name: u.name, email: u.email })')
    expect(lib).toContain("header.startsWith('Bearer ')")
    expect(lib).toContain('httpOnly: true')
    expect(USER_MODEL).toContain('email        String   @unique')
  })

  it('puts the User model before the client is generated, and migrates once the database runs', () => {
    const steps = plan().map(line)
    const at = (needle: string) => steps.findIndex(s => s.includes(needle))
    expect(at('append:')).toBeGreaterThan(at('prisma init'))
    expect(at('append:')).toBeLessThan(at('npx prisma generate'))
    expect(at('npx prisma migrate dev --name init')).toBeGreaterThan(at('docker compose up -d --wait database'))
    expect(steps).toContain('npm install bcryptjs jose')
    expect(steps.some(s => s.includes('next-auth'))).toBe(false)
  })

  it('keeps the plain Auth.js setup for a JavaScript project', () => {
    const steps = plan({}, false).map(line)
    expect(steps).toContain('npm install next-auth@beta')
    expect(steps.some(s => s.includes('migrate dev'))).toBe(false)
  })
})
