import type { SetupStep } from '../types'
import { AUTH_API_ENV, AUTH_RULES } from '../data/authContract'
import { ANVIL, DEVFORGE_CSS } from './devforgeStyle'

/**
 * v3.4 lot 6, 3.4.1: sign-in, sign-up and a dashboard for a React or Vue
 * (Vite, TypeScript) front, client of the shared contract. Laid out as:
 * src/api (calls to the server), src/pages (one view per page),
 * src/components (shared pieces), src/styles/devforge.css (the look),
 * src/Router (#/login, #/register, #/dashboard; the rest is the app).
 * In development the front calls /api on its own origin and Vite proxies it to
 * the server (no CORS); a production build reads VITE_API_URL. The token is
 * kept in localStorage and sent as Authorization: Bearer.
 */

export const DEFAULT_API_URL = 'http://localhost:8000'

/** Only an http(s) address with no quote or space goes into vite.config */
export const API_URL_RE = /^https?:\/\/[^\s'"`\\]+$/

const TEXT = {
  fr: {
    name: 'Nom', email: 'E-mail', password: 'Mot de passe', home: 'Accueil',
    login: { title: 'Se connecter', lead: 'Content de vous revoir.', submit: 'Se connecter', other: 'Pas encore de compte ?', otherLink: 'Créer un compte', otherHref: '#/register' },
    register: { title: 'Créer un compte', lead: 'Quelques secondes, et vous y êtes.', submit: 'Créer mon compte', other: 'Déjà un compte ?', otherLink: 'Se connecter', otherHref: '#/login' },
    hello: 'Bonjour', signedIn: 'Vous êtes connecté.', logout: 'Se déconnecter', loading: 'Chargement…', dashboard: 'Tableau de bord',
    apiTitle: 'Votre API', apiLead: 'Ce front suit le contrat DevForge : il parle à', network: 'Le serveur ne répond pas. Est-il lancé ?',
    password8: `Au moins ${AUTH_RULES.passwordMin} caractères.`
  },
  en: {
    name: 'Name', email: 'Email', password: 'Password', home: 'Home',
    login: { title: 'Sign in', lead: 'Good to see you again.', submit: 'Sign in', other: 'No account yet?', otherLink: 'Create an account', otherHref: '#/register' },
    register: { title: 'Create an account', lead: 'A few seconds, and you are in.', submit: 'Create my account', other: 'Already have an account?', otherLink: 'Sign in', otherHref: '#/login' },
    hello: 'Hello', signedIn: 'You are signed in.', logout: 'Sign out', loading: 'Loading…', dashboard: 'Dashboard',
    apiTitle: 'Your API', apiLead: 'This front follows the DevForge contract: it talks to', network: 'The server is not answering. Is it running?',
    password8: `At least ${AUTH_RULES.passwordMin} characters.`
  }
}

/** src/api/auth.ts: the contract's client, the same for React and Vue */
const CLIENT = `/** Client of the DevForge authentication contract (/api/auth/…) */

export type User = { id: string | number; name: string; email: string }
export type Errors = Partial<Record<'name' | 'email' | 'password', string[]>>

/** A refused call: its status, its field errors (422) and its message */
export class ApiError extends Error {
  status: number
  errors: Errors

  constructor(status: number, errors: Errors, message: string) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

/** Empty in development: Vite proxies /api to the server (vite.config.ts); set ${AUTH_API_ENV} for a production build */
const BASE: string = import.meta.env.${AUTH_API_ENV} ?? ''
const KEY = 'df-token'

export function getToken(): string | null {
  try { return localStorage.getItem(KEY) } catch { return null }
}

function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
  } catch { /* storage unavailable (private window): the session lasts the page */ }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = \`Bearer \${token}\`
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({})) as { errors?: Errors; message?: string }
  if (!res.ok) throw new ApiError(res.status, json.errors ?? {}, json.message ?? '')
  return json as T
}

/** POST /api/auth/login: keeps the token */
export async function login(email: string, password: string): Promise<User> {
  const res = await call<{ user: User; token: string }>('POST', '/api/auth/login', { email, password })
  setToken(res.token)
  return res.user
}

/** POST /api/auth/register, then signs in */
export async function register(name: string, email: string, password: string): Promise<User> {
  await call('POST', '/api/auth/register', { name, email, password })
  return login(email, password)
}

/** POST /api/auth/logout: the token is forgotten whatever the server says */
export async function logout(): Promise<void> {
  try { await call('POST', '/api/auth/logout') } finally { setToken(null) }
}

/** GET /api/auth/me: null when signed out (a refused token is forgotten) */
export async function me(): Promise<User | null> {
  if (!getToken()) return null
  try {
    return (await call<{ user: User }>('GET', '/api/auth/me')).user
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { setToken(null); return null }
    throw e
  }
}
`

const textsFile = (lang: 'fr' | 'en', name: string, apiUrl: string) => `/** Texts of the account pages, the project's name and DevForge's anvil (the look: styles/devforge.css) */
export const t = ${JSON.stringify({ ...TEXT[lang], project: name, api: apiUrl }, null, 2)}

export const anvil = ${JSON.stringify(ANVIL)}
`

// ─── React ────────────────────────────────────────────────────────────────────

const REACT_ROUTER = `import { useEffect, useState } from 'react'
import './styles/devforge.css'
import App from './App'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Register from './pages/Register'

/** #/login, #/register and #/dashboard; any other address shows the app */
const route = () => window.location.hash.replace(/^#/, '') || '/'

export default function Router() {
  const [path, setPath] = useState(route)
  useEffect(() => {
    const onHash = () => setPath(route())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  if (path === '/login') return <Login />
  if (path === '/register') return <Register />
  if (path === '/dashboard') return <Dashboard />
  return <App />
}
`

const REACT_SHELL = `import type { ReactNode } from 'react'
import { anvil, t } from '../texts'

/** The account pages' frame: the top bar, then the page */
export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="df-auth">
      <header className="df-bar">
        <a href="#/" className="df-brand"><span dangerouslySetInnerHTML={{ __html: anvil }} />{t.project}</a>
        <a href="#/">{t.home}</a>
      </header>
      <main className="df-center">{children}</main>
    </div>
  )
}
`

const REACT_FORM = `import { useState, type FormEvent } from 'react'
import { ApiError, login, register, type Errors } from '../api/auth'
import { t } from '../texts'

/** Sign-in or sign-up form: the fields depend on the page */
export default function AuthForm({ kind }: { kind: 'login' | 'register' }) {
  const w = t[kind]
  const [errors, setErrors] = useState<Errors>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const field = (name: string) => String(form.get(name) ?? '')
    setBusy(true); setErrors({}); setMessage('')
    try {
      if (kind === 'register') await register(field('name'), field('email'), field('password'))
      else await login(field('email'), field('password'))
      window.location.hash = '#/dashboard'
    } catch (err) {
      if (err instanceof ApiError) { setErrors(err.errors); setMessage(err.message) }
      else setMessage(t.network)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="df-box" onSubmit={submit} noValidate>
      <h1>{w.title}</h1>
      <p className="df-lead">{w.lead}</p>
      {message && <p className="df-alert" role="alert">{message}</p>}
      {kind === 'register' && (
        <label className="df-field">{t.name}
          <input name="name" autoComplete="name" required />
          {errors.name && <span className="df-err">{errors.name[0]}</span>}
        </label>
      )}
      <label className="df-field">{t.email}
        <input name="email" type="email" autoComplete="email" required />
        {errors.email && <span className="df-err">{errors.email[0]}</span>}
      </label>
      <label className="df-field">{t.password}
        <input name="password" type="password" autoComplete={kind === 'register' ? 'new-password' : 'current-password'} required />
        {errors.password && <span className="df-err">{errors.password[0]}</span>}
      </label>
      <button className="df-submit" type="submit" disabled={busy}>{w.submit}</button>
      <p className="df-small">{w.other} <a href={w.otherHref}>{w.otherLink}</a></p>
    </form>
  )
}
`

const REACT_ACCOUNT_NAV = `import { useEffect, useState } from 'react'
import { logout, me, type User } from '../api/auth'
import { t } from '../texts'

/** The welcome page's account links: who is signed in, from /api/auth/me */
export default function AccountNav() {
  const [user, setUser] = useState<User | null>(null)
  useEffect(() => {
    me().then(setUser).catch(() => setUser(null))
  }, [])

  async function signOut() {
    await logout().catch(() => undefined)
    setUser(null)
  }

  return (
    <nav className="df-nav">
      {user ? (
        <>
          <a className="df-btn" href="#/dashboard">{t.dashboard}</a>
          <button type="button" className="df-btn" onClick={signOut}>{t.logout}</button>
        </>
      ) : (
        <>
          <a className="df-btn" href="#/login">{t.login.title}</a>
          <a className="df-btn df-primary" href="#/register">{t.register.title}</a>
        </>
      )}
    </nav>
  )
}
`

const reactFormPage = (kind: 'login' | 'register') => `import AuthForm from '../components/AuthForm'
import Shell from '../components/Shell'

export default function ${kind === 'login' ? 'Login' : 'Register'}() {
  return <Shell><AuthForm kind="${kind}" /></Shell>
}
`

const REACT_DASHBOARD = `import { useEffect, useState } from 'react'
import { logout, me, type User } from '../api/auth'
import Shell from '../components/Shell'
import { t } from '../texts'

/** Only for a signed-in user: the others go to #/login */
export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    me().then(u => { if (u) setUser(u); else window.location.hash = '#/login' }).catch(() => setError(t.network))
  }, [])

  async function signOut() {
    await logout().catch(() => undefined)
    window.location.hash = '#/'
  }

  return (
    <Shell>
      {error ? <p className="df-alert" role="alert">{error}</p> : !user ? <p className="df-lead">{t.loading}</p> : (
        <div className="df-wide">
          <section className="df-box">
            <h1>{t.hello} {user.name}</h1>
            <p className="df-lead">{t.signedIn} {user.email}</p>
            <div><button type="button" className="df-ghost" onClick={signOut}>{t.logout}</button></div>
          </section>
          <section className="df-box">
            <h2>{t.apiTitle}</h2>
            <p className="df-note">{t.apiLead} <code>{t.api}</code></p>
          </section>
        </div>
      )}
    </Shell>
  )
}
`

// ─── Vue ──────────────────────────────────────────────────────────────────────

const VUE_ROUTER = `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import './styles/devforge.css'
import App from './App.vue'
import Dashboard from './pages/Dashboard.vue'
import Login from './pages/Login.vue'
import Register from './pages/Register.vue'

/** #/login, #/register and #/dashboard; any other address shows the app */
const route = () => window.location.hash.replace(/^#/, '') || '/'
const path = ref(route())
const onHash = () => { path.value = route() }
onMounted(() => window.addEventListener('hashchange', onHash))
onBeforeUnmount(() => window.removeEventListener('hashchange', onHash))
</script>

<template>
  <Login v-if="path === '/login'" />
  <Register v-else-if="path === '/register'" />
  <Dashboard v-else-if="path === '/dashboard'" />
  <App v-else />
</template>
`

const VUE_SHELL = `<script setup lang="ts">
import { anvil, t } from '../texts'
</script>

<!-- The account pages' frame: the top bar, then the page -->
<template>
  <div class="df-auth">
    <header class="df-bar">
      <a href="#/" class="df-brand"><span v-html="anvil"></span>{{ t.project }}</a>
      <a href="#/">{{ t.home }}</a>
    </header>
    <main class="df-center"><slot /></main>
  </div>
</template>
`

const VUE_FORM = `<script setup lang="ts">
import { ref } from 'vue'
import { ApiError, login, register, type Errors } from '../api/auth'
import { t } from '../texts'

const props = defineProps<{ kind: 'login' | 'register' }>()
const w = t[props.kind]
const name = ref('')
const email = ref('')
const password = ref('')
const errors = ref<Errors>({})
const message = ref('')
const busy = ref(false)

async function submit() {
  busy.value = true
  errors.value = {}
  message.value = ''
  try {
    if (props.kind === 'register') await register(name.value, email.value, password.value)
    else await login(email.value, password.value)
    window.location.hash = '#/dashboard'
  } catch (err) {
    if (err instanceof ApiError) { errors.value = err.errors; message.value = err.message }
    else message.value = t.network
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="df-box" novalidate @submit.prevent="submit">
    <h1>{{ w.title }}</h1>
    <p class="df-lead">{{ w.lead }}</p>
    <p v-if="message" class="df-alert" role="alert">{{ message }}</p>
    <label v-if="kind === 'register'" class="df-field">{{ t.name }}
      <input v-model="name" name="name" autocomplete="name" required>
      <span v-if="errors.name" class="df-err">{{ errors.name[0] }}</span>
    </label>
    <label class="df-field">{{ t.email }}
      <input v-model="email" name="email" type="email" autocomplete="email" required>
      <span v-if="errors.email" class="df-err">{{ errors.email[0] }}</span>
    </label>
    <label class="df-field">{{ t.password }}
      <input v-model="password" name="password" type="password" :autocomplete="kind === 'register' ? 'new-password' : 'current-password'" required>
      <span v-if="errors.password" class="df-err">{{ errors.password[0] }}</span>
    </label>
    <button class="df-submit" type="submit" :disabled="busy">{{ w.submit }}</button>
    <p class="df-small">{{ w.other }} <a :href="w.otherHref">{{ w.otherLink }}</a></p>
  </form>
</template>
`

const VUE_ACCOUNT_NAV = `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { logout, me, type User } from '../api/auth'
import { t } from '../texts'

// The welcome page's account links: who is signed in, from /api/auth/me
const user = ref<User | null>(null)
onMounted(() => { me().then(u => { user.value = u }).catch(() => { user.value = null }) })

async function signOut() {
  await logout().catch(() => undefined)
  user.value = null
}
</script>

<template>
  <nav class="df-nav">
    <template v-if="user">
      <a class="df-btn" href="#/dashboard">{{ t.dashboard }}</a>
      <button type="button" class="df-btn" @click="signOut">{{ t.logout }}</button>
    </template>
    <template v-else>
      <a class="df-btn" href="#/login">{{ t.login.title }}</a>
      <a class="df-btn df-primary" href="#/register">{{ t.register.title }}</a>
    </template>
  </nav>
</template>
`

const vueFormPage = (kind: 'login' | 'register') => `<script setup lang="ts">
import AuthForm from '../components/AuthForm.vue'
import Shell from '../components/Shell.vue'
</script>

<template>
  <Shell><AuthForm kind="${kind}" /></Shell>
</template>
`

const VUE_DASHBOARD = `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { logout, me, type User } from '../api/auth'
import Shell from '../components/Shell.vue'
import { t } from '../texts'

// Only for a signed-in user: the others go to #/login
const user = ref<User | null>(null)
const error = ref('')

onMounted(() => {
  me().then(u => { if (u) user.value = u; else window.location.hash = '#/login' }).catch(() => { error.value = t.network })
})

async function signOut() {
  await logout().catch(() => undefined)
  window.location.hash = '#/'
}
</script>

<template>
  <Shell>
    <p v-if="error" class="df-alert" role="alert">{{ error }}</p>
    <p v-else-if="!user" class="df-lead">{{ t.loading }}</p>
    <div v-else class="df-wide">
      <section class="df-box">
        <h1>{{ t.hello }} {{ user.name }}</h1>
        <p class="df-lead">{{ t.signedIn }} {{ user.email }}</p>
        <div><button type="button" class="df-ghost" @click="signOut">{{ t.logout }}</button></div>
      </section>
      <section class="df-box">
        <h2>{{ t.apiTitle }}</h2>
        <p class="df-note">{{ t.apiLead }} <code>{{ t.api }}</code></p>
      </section>
    </div>
  </Shell>
</template>
`

/** The auth files of a Vite React or Vue project (TypeScript) */
export function spaAuthFiles(framework: 'react' | 'vue', name: string, lang: 'fr' | 'en', apiUrl: string): { path: string; content: string }[] {
  const common = [
    { path: 'src/api/auth.ts', content: CLIENT },
    { path: 'src/texts.ts', content: textsFile(lang, name, apiUrl) },
    { path: 'src/styles/devforge.css', content: DEVFORGE_CSS }
  ]
  if (framework === 'react') {
    return [
      ...common,
      { path: 'src/Router.tsx', content: REACT_ROUTER },
      { path: 'src/components/Shell.tsx', content: REACT_SHELL },
      { path: 'src/components/AuthForm.tsx', content: REACT_FORM },
      { path: 'src/components/AccountNav.tsx', content: REACT_ACCOUNT_NAV },
      { path: 'src/pages/Login.tsx', content: reactFormPage('login') },
      { path: 'src/pages/Register.tsx', content: reactFormPage('register') },
      { path: 'src/pages/Dashboard.tsx', content: REACT_DASHBOARD }
    ]
  }
  return [
    ...common,
    { path: 'src/Router.vue', content: VUE_ROUTER },
    { path: 'src/components/Shell.vue', content: VUE_SHELL },
    { path: 'src/components/AuthForm.vue', content: VUE_FORM },
    { path: 'src/components/AccountNav.vue', content: VUE_ACCOUNT_NAV },
    { path: 'src/pages/Login.vue', content: vueFormPage('login') },
    { path: 'src/pages/Register.vue', content: vueFormPage('register') },
    { path: 'src/pages/Dashboard.vue', content: VUE_DASHBOARD }
  ]
}

/** Mount the router in place of App, proxy /api to the server, and say where the API is */
export function spaAuthPatches(framework: 'react' | 'vue', apiUrl: string, label: { main: string; proxy: string }): SetupStep[] {
  const react = framework === 'react'
  return [
    {
      kind: 'patch', label: label.main, file: react ? 'src/main.tsx' : 'src/main.ts',
      find: react ? "import App from '\\./App(\\.tsx)?'" : "import App from '\\./App\\.vue'", mode: 'replace',
      unless: './Router', text: react ? "import App from './Router'" : "import App from './Router.vue'"
    },
    {
      kind: 'patch', label: label.proxy, file: 'vite.config.ts', find: 'plugins:\\s*\\[', mode: 'replace', unless: "'/api'",
      text: `// DevForge: the contract's API, on the server's address (no CORS in development)\n  server: { proxy: { '/api': { target: '${apiUrl}', changeOrigin: true } } },\n  plugins: [`
    },
    { kind: 'env', label: '.env.example', file: '.env.example', vars: { [AUTH_API_ENV]: '' } }
  ]
}
