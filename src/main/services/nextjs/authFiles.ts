import type { AuthProvider } from '@shared/types'
import { GENERATED_MARK } from './nextFiles'

/**
 * Auth.js in the Next.js workshop (v2.3 lot 4): the Prisma adapter's models,
 * auth.ts, the sign-in and sign-up pages, and a route that needs a session.
 * Pure text; the service decides where and with which import paths.
 */

/** The models of Auth.js's Prisma adapter, a password for e-mail sign-in */
export const AUTH_MODELS = `
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  /// Hashed (bcrypt), for e-mail and password sign-in
  password      String?
  accounts      Account[]
  sessions      Session[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Account {
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([provider, providerAccountId])
}

model Session {
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@id([identifier, token])
}
`

export type AuthModels = 'missing' | 'present' | 'conflict'

/** Auth's models in a schema: all there, none (to add), or a User of another shape */
export function authModels(schema: string): AuthModels {
  const has = (name: string) => new RegExp(`^model\\s+${name}\\s*\\{`, 'm').test(schema)
  const names = ['User', 'Account', 'Session', 'VerificationToken']
  if (names.every(has)) return /model\s+User\s*\{[^}]*accounts\s+Account\[\]/.test(schema) ? 'present' : 'conflict'
  return names.some(has) ? 'conflict' : 'missing'
}

export const withAuthModels = (schema: string) => schema.replace(/\s*$/, '\n') + AUTH_MODELS

/** The project's own auth.ts when DevForge may rewrite it: its own, or the one of the creation */
export const rewritable = (src: string) => !src || src.includes(GENERATED_MARK) || /NextAuth\(\{\s*providers:\s*\[\]\s*\}\)/.test(src)

const PROVIDER = {
  github: { import: "import GitHub from 'next-auth/providers/github'", use: 'GitHub' },
  google: { import: "import Google from 'next-auth/providers/google'", use: 'Google' }
} as const

export function authFile(providers: AuthProvider[], lib: string): string {
  const oauth = providers.filter((p): p is 'github' | 'google' => p !== 'credentials')
  const credentials = providers.includes('credentials')
  return `${GENERATED_MARK}: Auth.js, rewritten from the Next.js workshop.
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
${oauth.map(p => PROVIDER[p].import + '\n').join('')}${credentials ? "import Credentials from 'next-auth/providers/credentials'\nimport bcrypt from 'bcryptjs'\n" : ''}import { prisma } from '${lib}'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // JWT sessions: the only kind e-mail and password sign-in allows
  session: { strategy: 'jwt' },
  pages: { signIn: '/connexion' },
  providers: [
${[
    ...oauth.map(p => `    // Keys in .env.local: AUTH_${p.toUpperCase()}_ID and AUTH_${p.toUpperCase()}_SECRET\n    ${PROVIDER[p].use}`),
    ...(credentials ? [`    Credentials({
      credentials: { email: { label: 'E-mail', type: 'email' }, password: { label: 'Mot de passe', type: 'password' } },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase()
        const password = String(credentials?.password ?? '')
        if (!email || !password) return null
        const user = await prisma.user.findUnique({ where: { email } })
        if (!user?.password || !(await bcrypt.compare(password, user.password))) return null
        return { id: user.id, email: user.email, name: user.name }
      }
    })`] : [])
  ].join(',\n')}
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (token.sub && session.user) session.user.id = token.sub
      return session
    }
  }
})
`
}

export const handlerFile = (authImport: string) => `import { handlers } from '${authImport}'

export const { GET, POST } = handlers
`

/** A route that needs a session: 401 without one */
export const meRouteFile = (authImport: string) => `${GENERATED_MARK}: an example of a route that needs a session (Next.js workshop).
import { NextResponse } from 'next/server'
import { auth } from '${authImport}'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  return NextResponse.json(session.user)
}
`

/** POST /api/inscription: a form or JSON (email, password, name), the password hashed */
export const signUpRouteFile = (lib: string, ts: boolean) => `${GENERATED_MARK}: sign-up with e-mail and password (Next.js workshop).
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '${lib}'

export async function POST(request${ts ? ': Request' : ''}) {
  const form = !(request.headers.get('content-type') ?? '').includes('application/json')
  const body = form ? Object.fromEntries((await request.formData()).entries()) : await request.json().catch(() => ({}))
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  const name = String(body.name ?? '').trim() || null
  const back = (query${ts ? ': string' : ''}, status${ts ? ': number' : ''}) => form
    ? NextResponse.redirect(new URL(\`/\${query}\`, request.url), 303)
    : NextResponse.json({ result: query }, { status })

  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || password.length < 8) return back('inscription?erreur=invalide', 422)
  if (await prisma.user.findUnique({ where: { email } })) return back('inscription?erreur=existe', 409)
  await prisma.user.create({ data: { email, name, password: await bcrypt.hash(password, 10) } })
  return back('connexion?inscrit=1', 201)
}
`

const PAGE_STYLE = "{ maxWidth: 380, margin: '64px auto', display: 'grid', gap: 12, fontFamily: 'system-ui, sans-serif' }"

export function signInPageFile(providers: AuthProvider[], authImport: string, ts: boolean): string {
  const oauth = providers.filter(p => p !== 'credentials')
  const label = { github: 'Continuer avec GitHub', google: 'Continuer avec Google' } as Record<string, string>
  const params = ts ? ': { searchParams: Promise<{ erreur?: string; inscrit?: string }> }' : ''
  return `${GENERATED_MARK}: the sign-in page (Next.js workshop).
import { Suspense } from 'react'
import { AuthError } from 'next-auth'
import { redirect } from 'next/navigation'
import { signIn } from '${authImport}'

/** Read apart, in Suspense: the rest of the page is static */
async function Message({ searchParams }${params}) {
  const { erreur, inscrit } = await searchParams
  if (inscrit) return <p role="status">Compte créé : tu peux te connecter.</p>
  return erreur ? <p role="alert">E-mail ou mot de passe incorrect.</p> : null
}

export default function Connexion({ searchParams }${params}) {
  return (
    <main style={${PAGE_STYLE}}>
      <h1>Connexion</h1>
      <Suspense fallback={null}><Message searchParams={searchParams} /></Suspense>
${oauth.map(p => `      <form action={async () => { 'use server'; await signIn('${p}', { redirectTo: '/' }) }}>
        <button type="submit">${label[p]}</button>
      </form>`).join('\n')}${providers.includes('credentials') ? `
      <form style={{ display: 'grid', gap: 8 }} action={async (data${ts ? ': FormData' : ''}) => {
        'use server'
        try {
          await signIn('credentials', { email: data.get('email'), password: data.get('password'), redirectTo: '/' })
        } catch (err) {
          // A refused password; the redirection after a success is thrown too and goes on
          if (err instanceof AuthError) redirect('/connexion?erreur=1')
          throw err
        }
      }}>
        <label>E-mail <input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe <input name="password" type="password" required autoComplete="current-password" /></label>
        <button type="submit">Se connecter</button>
      </form>
      <a href="/inscription">Créer un compte</a>` : ''}
    </main>
  )
}
`
}

export const signUpPageFile = (ts: boolean) => `${GENERATED_MARK}: the sign-up page (Next.js workshop).
import { Suspense } from 'react'

/** Read apart, in Suspense: the rest of the page is static */
async function Message({ searchParams }${ts ? ': { searchParams: Promise<{ erreur?: string }> }' : ''}) {
  const { erreur } = await searchParams
  if (erreur === 'existe') return <p role="alert">Un compte existe déjà avec cet e-mail.</p>
  return erreur ? <p role="alert">Un e-mail valide et un mot de passe d'au moins 8 caractères.</p> : null
}

export default function Inscription({ searchParams }${ts ? ': { searchParams: Promise<{ erreur?: string }> }' : ''}) {
  return (
    <main style={${PAGE_STYLE}}>
      <h1>Créer un compte</h1>
      <Suspense fallback={null}><Message searchParams={searchParams} /></Suspense>
      <form method="post" action="/api/inscription" style={{ display: 'grid', gap: 8 }}>
        <label>Nom <input name="name" autoComplete="name" /></label>
        <label>E-mail <input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe <input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
        <button type="submit">Créer le compte</button>
      </form>
      <a href="/connexion">J'ai déjà un compte</a>
    </main>
  )
}
`

/** The keys each provider needs in .env.local */
export const PROVIDER_KEYS: Record<AuthProvider, string[]> = {
  github: ['AUTH_GITHUB_ID', 'AUTH_GITHUB_SECRET'],
  google: ['AUTH_GOOGLE_ID', 'AUTH_GOOGLE_SECRET'],
  credentials: []
}
export const AUTH_KEYS = ['AUTH_SECRET', 'AUTH_TRUST_HOST', ...PROVIDER_KEYS.github, ...PROVIDER_KEYS.google]
