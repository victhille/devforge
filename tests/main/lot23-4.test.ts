import { describe, expect, it } from 'vitest'
import * as af from '../../src/main/services/nextjs/authFiles'
import { parseSchema, toEntities } from '../../src/main/services/nextjs/prismaSchema'

const BASE = 'datasource db {\n  provider = "postgresql"\n}\n\nmodel Note {\n  id    Int    @id @default(autoincrement())\n  texte String\n}\n'

/** v2.3 lot 4: Auth.js in the Next.js workshop */
describe('v2.3 lot 4: Auth.js files', () => {
  it('adds the adapter\'s models once, refuses a User of another shape', () => {
    expect(af.authModels(BASE)).toBe('missing')
    const withAuth = af.withAuthModels(BASE)
    expect(af.authModels(withAuth)).toBe('present')
    expect(toEntities(parseSchema(withAuth)).map(e => e.name).sort()).toEqual(['Account', 'Note', 'Session', 'User', 'VerificationToken'])
    expect(af.authModels(BASE + '\nmodel User {\n  id Int @id\n  email String\n}\n')).toBe('conflict')
  })

  it('auth.ts has the chosen providers only, credentials with bcrypt and JWT sessions', () => {
    const both = af.authFile(['github', 'credentials'], './lib/prisma')
    expect(both).toContain("import GitHub from 'next-auth/providers/github'")
    expect(both).not.toContain('Google')
    expect(both).toContain('bcrypt.compare(password, user.password)')
    expect(both).toContain("session: { strategy: 'jwt' }")
    expect(both).toContain("import { prisma } from './lib/prisma'")
    expect(af.authFile(['google'], './lib/prisma')).not.toContain('Credentials')
  })

  it('rewrites only its own auth.ts or the one of the creation', () => {
    expect(af.rewritable('')).toBe(true)
    expect(af.rewritable("export const { handlers } = NextAuth({ providers: [] })")).toBe(true)
    expect(af.rewritable(af.authFile(['github'], './lib/prisma'))).toBe(true)
    expect(af.rewritable("export const { handlers } = NextAuth({ providers: [Discord] })")).toBe(false)
  })

  it('pages read their message in Suspense; the sign-up route hashes and answers 201, 409, 422', () => {
    const page = af.signInPageFile(['github', 'credentials'], '../../auth', true)
    expect(page).toContain('<Suspense fallback={null}><Message searchParams={searchParams} /></Suspense>')
    expect(page).toContain('Continuer avec GitHub')
    expect(page).toContain('if (err instanceof AuthError) redirect')
    expect(af.signInPageFile(['github'], '../../auth', true)).not.toContain('Créer un compte')
    const route = af.signUpRouteFile('../../../lib/prisma', true)
    expect(route).toContain('await bcrypt.hash(password, 10)')
    expect(route).toContain("back('inscription?erreur=existe', 409)")
    expect(af.meRouteFile('../../../auth')).toContain('{ status: 401 }')
  })
})
