import { AUTH_RULES } from '../data/authContract'
import { ANVIL, DEVFORGE_CSS } from './devforgeStyle'

/**
 * v3.4 lot 3: sign-up, sign-in and a protected page for a Next.js project,
 * following the shared contract (src/shared/data/authContract.ts).
 * A JWT signed with AUTH_SECRET (jose) goes both in an httpOnly cookie, for
 * the pages, and in the login's JSON, for any client using Bearer. Passwords
 * are hashed with bcryptjs; accounts live in Prisma's User model.
 * TypeScript only; {app} and {src} are resolved by the main process.
 */

export const NEXT_AUTH_PACKAGES = ['bcryptjs', 'jose']

/** Added to prisma/schema.prisma right after `prisma init` */
export const USER_MODEL = `
model User {
  id           String   @id @default(cuid())
  name         String
  email        String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
`

const TEXT = {
  fr: {
    name: 'Nom', email: 'E-mail', password: 'Mot de passe', home: 'Accueil',
    loginTitle: 'Se connecter', loginLead: 'Content de vous revoir.', loginSubmit: 'Se connecter', noAccount: 'Pas encore de compte ?', toRegister: 'Créer un compte',
    registerTitle: 'Créer un compte', registerLead: 'Quelques secondes, et vous y êtes.', registerSubmit: 'Créer mon compte', hasAccount: 'Déjà un compte ?', toLogin: 'Se connecter',
    hello: 'Bonjour', signedIn: 'Vous êtes connecté.', logout: 'Se déconnecter', apiTitle: 'Votre API', dashboard: 'Tableau de bord',
    apiLead: 'Ces routes suivent le contrat DevForge : un front React ou Vue créé par DevForge s\'y branche tel quel.',
    errName: 'Indiquez un nom.', errEmail: 'Indiquez une adresse e-mail valide.', errPassword: `Au moins ${AUTH_RULES.passwordMin} caractères.`,
    errTaken: 'Cette adresse a déjà un compte.', errInvalid: 'E-mail ou mot de passe incorrect.', errAuth: 'Connectez-vous d\'abord.', errNetwork: 'Le serveur ne répond pas.'
  },
  en: {
    name: 'Name', email: 'Email', password: 'Password', home: 'Home',
    loginTitle: 'Sign in', loginLead: 'Good to see you again.', loginSubmit: 'Sign in', noAccount: 'No account yet?', toRegister: 'Create an account',
    registerTitle: 'Create an account', registerLead: 'A few seconds, and you are in.', registerSubmit: 'Create my account', hasAccount: 'Already have an account?', toLogin: 'Sign in',
    hello: 'Hello', signedIn: 'You are signed in.', logout: 'Sign out', apiTitle: 'Your API', dashboard: 'Dashboard',
    apiLead: 'These routes follow the DevForge contract: a React or Vue front made by DevForge plugs in as is.',
    errName: 'Enter a name.', errEmail: 'Enter a valid email address.', errPassword: `At least ${AUTH_RULES.passwordMin} characters.`,
    errTaken: 'This address already has an account.', errInvalid: 'Wrong email or password.', errAuth: 'Sign in first.', errNetwork: 'The server is not answering.'
  }
}

const libAuth = (t: typeof TEXT.fr) => `import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

/** Sign-up, sign-in and sessions, as the DevForge contract describes them (/api/auth/…) */

export const SESSION_COOKIE = 'session'
const WEEK = 60 * 60 * 24 * 7

export const messages = ${JSON.stringify({ name: t.errName, email: t.errEmail, password: t.errPassword, taken: t.errTaken, invalid: t.errInvalid, unauthenticated: t.errAuth }, null, 2)}

export type PublicUser = { id: string; name: string; email: string }
type Field = 'name' | 'email' | 'password'
export type Errors = Partial<Record<Field, string[]>>

/** What the API shows of a user: never the password nor its hash */
export const publicUser = (u: PublicUser): PublicUser => ({ id: u.id, name: u.name, email: u.email })

export const hashPassword = (password: string) => bcrypt.hash(password, 12)
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash)

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET ?? '')

export function signToken(userId: string): Promise<string> {
  return new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('7d').sign(secret())
}

/** The user behind a token: null when it is missing, expired or forged */
export async function userFromToken(token: string | undefined): Promise<PublicUser | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret())
    const user = payload.sub ? await prisma.user.findUnique({ where: { id: payload.sub } }) : null
    return user ? publicUser(user) : null
  } catch {
    return null
  }
}

/** The signed-in user: Authorization: Bearer first (API clients), else the session cookie (pages) */
export async function currentUser(request?: Request): Promise<PublicUser | null> {
  const header = request?.headers.get('authorization') ?? ''
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : undefined
  return userFromToken(bearer ?? (await cookies()).get(SESSION_COOKIE)?.value)
}

export async function setSession(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: WEEK })
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE)
}

/** The request's JSON body, an empty object when it has none */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => ({}))
  return body && typeof body === 'object' ? body as Record<string, unknown> : {}
}

/** The contract's rules: a name, a valid email, ${AUTH_RULES.passwordMin} characters for the password */
export function validate(body: Record<string, unknown>, fields: Field[]): { data: Record<Field, string>; errors: Errors | null } {
  const text = (f: Field) => typeof body[f] === 'string' ? body[f] as string : ''
  const data = { name: text('name').trim(), email: text('email').trim().toLowerCase(), password: text('password') }
  const errors: Errors = {}
  if (fields.includes('name') && (!data.name || data.name.length > ${AUTH_RULES.nameMax})) errors.name = [messages.name]
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.email) || data.email.length > ${AUTH_RULES.emailMax}) errors.email = [messages.email]
  if (data.password.length < ${AUTH_RULES.passwordMin}) errors.password = [messages.password]
  return { data, errors: Object.keys(errors).length ? errors : null }
}
`

const ROUTE_REGISTER = `import { prisma } from '@/lib/prisma'
import { hashPassword, messages, publicUser, readBody, validate } from '@/lib/auth'

/** POST /api/auth/register { name, email, password } → 201 { user } */
export async function POST(request: Request) {
  const { data, errors } = validate(await readBody(request), ['name', 'email', 'password'])
  if (errors) return Response.json({ errors }, { status: 422 })
  if (await prisma.user.findUnique({ where: { email: data.email } })) {
    return Response.json({ errors: { email: [messages.taken] } }, { status: 422 })
  }
  const user = await prisma.user.create({ data: { name: data.name, email: data.email, passwordHash: await hashPassword(data.password) } })
  return Response.json({ user: publicUser(user) }, { status: 201 })
}
`

const ROUTE_LOGIN = `import { prisma } from '@/lib/prisma'
import { checkPassword, messages, publicUser, readBody, setSession, signToken, validate } from '@/lib/auth'

/** POST /api/auth/login { email, password } → 200 { user, token }, and the session cookie */
export async function POST(request: Request) {
  const { data, errors } = validate(await readBody(request), ['email', 'password'])
  if (errors) return Response.json({ errors }, { status: 422 })
  const user = await prisma.user.findUnique({ where: { email: data.email } })
  if (!user || !(await checkPassword(data.password, user.passwordHash))) {
    return Response.json({ message: messages.invalid }, { status: 401 })
  }
  const token = await signToken(user.id)
  await setSession(token)
  return Response.json({ user: publicUser(user), token })
}
`

const ROUTE_LOGOUT = `import { clearSession, currentUser, messages } from '@/lib/auth'

/** POST /api/auth/logout → 204 (the session cookie is cleared; a token stays valid until it expires) */
export async function POST(request: Request) {
  if (!(await currentUser(request))) return Response.json({ message: messages.unauthenticated }, { status: 401 })
  await clearSession()
  return new Response(null, { status: 204 })
}
`

const ROUTE_ME = `import { currentUser, messages } from '@/lib/auth'

/** GET /api/auth/me → 200 { user } / 401 */
export async function GET(request: Request) {
  const user = await currentUser(request)
  return user ? Response.json({ user }) : Response.json({ message: messages.unauthenticated }, { status: 401 })
}
`

/** The brand the pages share; their look is app/devforge.css */
const brand = (name: string) => `/** The project's name and DevForge's anvil, in the account pages' top bar (their look: app/devforge.css) */
export const anvil = ${JSON.stringify(ANVIL)}

export const projectName = ${JSON.stringify(name)}
`

/** The top bar every auth page shares (each page has its own \`t.home\`) */
const BAR = `      <header className="df-bar">
        <a href="/" className="df-brand"><span dangerouslySetInnerHTML={{ __html: anvil }} />{projectName}</a>
        <a href="/">{t.home}</a>
      </header>`

/** Sign-in or sign-up form: one client component, the fields depend on the page */
const formPage = (kind: 'login' | 'register', t: typeof TEXT.fr) => {
  const register = kind === 'register'
  const words = register
    ? { title: t.registerTitle, lead: t.registerLead, submit: t.registerSubmit, other: t.hasAccount, otherLink: t.toLogin, otherHref: '/login' }
    : { title: t.loginTitle, lead: t.loginLead, submit: t.loginSubmit, other: t.noAccount, otherLink: t.toRegister, otherHref: '/register' }
  return `'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import '../devforge.css'
import { anvil, projectName } from '@/lib/brand'

type Errors = Partial<Record<'name' | 'email' | 'password', string[]>>

const t = ${JSON.stringify({ ...words, home: t.home, name: t.name, email: t.email, password: t.password, network: t.errNetwork }, null, 2)}

async function post(path: string, body: Record<string, FormDataEntryValue>) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { ok: res.ok, json: await res.json().catch(() => ({})) as { errors?: Errors; message?: string } }
}

export default function ${register ? 'RegisterPage' : 'LoginPage'}() {
  const router = useRouter()
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true); setErrors({}); setMessage('')
    const body = Object.fromEntries(new FormData(e.currentTarget))
    try {
      ${register ? `const created = await post('/api/auth/register', body)
      const res = created.ok ? await post('/api/auth/login', { email: body.email, password: body.password }) : created` : `const res = await post('/api/auth/login', body)`}
      if (res.ok) { router.push('/dashboard'); router.refresh(); return }
      setErrors(res.json.errors ?? {})
      setMessage(res.json.message ?? '')
    } catch {
      setMessage(t.network)
    }
    setBusy(false)
  }

  return (
    <div className="df-auth">
${BAR}
      <main className="df-center">
        <form className="df-box" onSubmit={submit} noValidate>
          <h1>{t.title}</h1>
          <p className="df-lead">{t.lead}</p>
          {message && <p className="df-alert" role="alert">{message}</p>}
${register ? `          <label className="df-field">{t.name}
            <input name="name" autoComplete="name" required />
            {errors.name && <span className="df-err">{errors.name[0]}</span>}
          </label>
` : ''}          <label className="df-field">{t.email}
            <input name="email" type="email" autoComplete="email" required />
            {errors.email && <span className="df-err">{errors.email[0]}</span>}
          </label>
          <label className="df-field">{t.password}
            <input name="password" type="password" autoComplete="${register ? 'new-password' : 'current-password'}" required />
            {errors.password && <span className="df-err">{errors.password[0]}</span>}
          </label>
          <button className="df-submit" type="submit" disabled={busy}>{t.submit}</button>
          <p className="df-small">{t.other} <a href={t.otherHref}>{t.otherLink}</a></p>
        </form>
      </main>
    </div>
  )
}
`
}

const dashboardPage = (t: typeof TEXT.fr) => `import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import '../devforge.css'
import { anvil, projectName } from '@/lib/brand'
import LogoutButton from './logout-button'

const t = ${JSON.stringify({ home: t.home, hello: t.hello, signedIn: t.signedIn, apiTitle: t.apiTitle, apiLead: t.apiLead }, null, 2)}

const routes = [
  ['POST', '/api/auth/register'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/logout'],
  ['GET', '/api/auth/me']
]

/** The signed-in account; the others go to /login. Reads the session cookie,
 * so it streams inside <Suspense> (Next.js 16's Cache Components refuse it outside) */
async function Account() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return (
    <section className="df-box">
      <h1>{t.hello} {user.name}</h1>
      <p className="df-lead">{t.signedIn} {user.email}</p>
      <div><LogoutButton /></div>
    </section>
  )
}

export default function DashboardPage() {
  return (
    <div className="df-auth">
${BAR}
      <main className="df-center">
        <div className="df-wide">
          <Suspense fallback={<section className="df-box" aria-busy="true" />}>
            <Account />
          </Suspense>
          <section className="df-box">
            <h2>{t.apiTitle}</h2>
            <p className="df-note">{t.apiLead}</p>
            <ul className="df-routes">
              {routes.map(([method, path]) => <li key={path}><b>{method}</b>{path}</li>)}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
`

const logoutButton = (t: typeof TEXT.fr) => `'use client'

import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
    router.refresh()
  }
  return <button type="button" className="df-ghost" onClick={logout}>{${JSON.stringify(t.logout)}}</button>
}
`

/** The welcome page's account links: who is signed in, from /api/auth/me (the session cookie) */
const accountNav = (t: typeof TEXT.fr) => `'use client'

import { useEffect, useState } from 'react'

const t = ${JSON.stringify({ login: t.loginTitle, register: t.registerTitle, dashboard: t.dashboard, logout: t.logout }, null, 2)}

export default function AccountNav() {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then((json: { user?: { name: string } } | null) => setName(json?.user?.name ?? null))
      .catch(() => setName(null))
  }, [])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setName(null)
  }

  return (
    <nav className="df-nav">
      {name ? (
        <>
          <a className="df-btn" href="/dashboard">{t.dashboard}</a>
          <button type="button" className="df-btn" onClick={logout}>{t.logout}</button>
        </>
      ) : (
        <>
          <a className="df-btn" href="/login">{t.login}</a>
          <a className="df-btn df-primary" href="/register">{t.register}</a>
        </>
      )}
    </nav>
  )
}
`

/** Every file of the Next.js authentication, paths with {app} and {src} */
export function nextAuthFiles(name: string, lang: 'fr' | 'en'): { path: string; content: string }[] {
  const t = TEXT[lang]
  return [
    { path: '{src}lib/auth.ts', content: libAuth(t) },
    { path: '{src}lib/brand.ts', content: brand(name) },
    { path: '{app}/devforge.css', content: DEVFORGE_CSS },
    { path: '{app}/account-nav.tsx', content: accountNav(t) },
    { path: '{app}/api/auth/register/route.ts', content: ROUTE_REGISTER },
    { path: '{app}/api/auth/login/route.ts', content: ROUTE_LOGIN },
    { path: '{app}/api/auth/logout/route.ts', content: ROUTE_LOGOUT },
    { path: '{app}/api/auth/me/route.ts', content: ROUTE_ME },
    { path: '{app}/login/page.tsx', content: formPage('login', t) },
    { path: '{app}/register/page.tsx', content: formPage('register', t) },
    { path: '{app}/dashboard/page.tsx', content: dashboardPage(t) },
    { path: '{app}/dashboard/logout-button.tsx', content: logoutButton(t) }
  ]
}
