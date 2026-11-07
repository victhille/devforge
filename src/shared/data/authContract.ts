/**
 * v3.4 lot 2: the authentication API every server DevForge creates exposes
 * (Next.js, Laravel, Symfony), so a React or Vue front made by DevForge works
 * with any of them. Written once here: the templates of lots 3 to 6 follow it,
 * and their tests check them against it.
 *
 * Tokens: Laravel hands out Sanctum's personal tokens (kept in its database);
 * Next.js and Symfony sign a JWT with the project's secret (no table). Either
 * way the client only sees an opaque string sent as `Authorization: Bearer`.
 */

export type AuthRouteName = 'register' | 'login' | 'logout' | 'me'

export interface AuthRoute {
  method: 'GET' | 'POST'
  path: string
  /** Fields of the JSON body */
  body: string[]
  /** Needs the token (or the session) */
  auth: boolean
  /** Status on success */
  ok: 200 | 201 | 204
}

export const AUTH_ROUTES: Record<AuthRouteName, AuthRoute> = {
  register: { method: 'POST', path: '/api/auth/register', body: ['name', 'email', 'password'], auth: false, ok: 201 },
  login:    { method: 'POST', path: '/api/auth/login',    body: ['email', 'password'],         auth: false, ok: 200 },
  logout:   { method: 'POST', path: '/api/auth/logout',   body: [],                            auth: true,  ok: 204 },
  me:       { method: 'GET',  path: '/api/auth/me',       body: [],                            auth: true,  ok: 200 }
}

/** The user as the API returns it: never the password nor its hash */
export interface AuthUser {
  id: string | number
  name: string
  email: string
}

/** register → 201 { user }; login → 200 { user, token }; me → 200 { user } */
export interface AuthUserResponse { user: AuthUser }
export interface AuthLoginResponse { user: AuthUser; token: string }

/** 422: one or more messages per field; 401: identifiers refused or token missing */
export interface AuthValidationError { errors: Partial<Record<'name' | 'email' | 'password', string[]>> }
export interface AuthUnauthorized { message: string }

/** Rules the three servers apply in the same way */
export const AUTH_RULES = {
  nameMax: 255,
  emailMax: 255,
  passwordMin: 8,
  /** Laravel bcrypt, Symfony "auto" (bcrypt or argon2), Next.js bcryptjs */
  hash: 'bcrypt'
} as const

/** Pages of the sign-in UI each template adds (React and Vue route by the hash) */
export const AUTH_PAGES = { login: '/login', register: '/register', dashboard: '/dashboard' } as const

/** The address a React or Vue front calls, from its .env (Vite exposes VITE_*) */
export const AUTH_API_ENV = 'VITE_API_URL'
