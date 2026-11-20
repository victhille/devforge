import { createHash, randomBytes } from 'crypto'
import { shell } from 'electron'
import type { GithubDeviceCode, VercelAccount } from '@shared/types'
import { log } from '../../lib/log'
import { LOOPBACK_URL, openLoopback } from '../../lib/oauthLoopback'
import { saveToken as saveGithubToken } from '../github/githubService'
import { saveSession as saveVercelSession, type VercelTokens } from '../vercel/vercelService'
import {
  GITHUB_SCOPES,
  VERCEL_AUTHORIZE_URL,
  VERCEL_SCOPES,
  githubClientId,
  githubDeviceCodeUrl,
  githubTokenUrl,
  vercelClientId,
  vercelTokenUrl
} from './oauthApps'

/**
 * Signing in without a token to copy. GitHub: a code the user types on github.com (device flow), then
 * DevForge waits for the token. Vercel: the browser opens, the user accepts, it comes back to this PC
 * (PKCE). Either way the token is then kept like a pasted one, encrypted. One sign-in at a time.
 */

export const signInAvailable = () => ({ github: !!githubClientId(), vercel: !!vercelClientId() })

const form = (url: string, body: Record<string, string>, signal?: AbortSignal) =>
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000)
  })

/** The sign-in under way: cancelled by the window, or by another one */
let current: AbortController | null = null

function begin(): AbortController {
  current?.abort()
  current = new AbortController()
  return current
}

export function cancelSignIn(): void {
  current?.abort()
  current = null
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), reject(new Error('CANCELLED'))), { once: true })
  })

// ─── GitHub: the device flow ─────────────────────────────────────────────────

let device: { code: string; interval: number; until: number; signal: AbortSignal } | null = null

/** Asks GitHub for a code: the window shows it, with the page where it is typed */
export async function githubStart(): Promise<GithubDeviceCode> {
  const clientId = githubClientId()
  if (!clientId) throw new Error('SIGN_IN_UNAVAILABLE')
  const { signal } = begin()
  const res = await form(githubDeviceCodeUrl(), { client_id: clientId, scope: GITHUB_SCOPES }, signal)
  const r = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || typeof r.device_code !== 'string' || typeof r.user_code !== 'string') throw new Error(`GitHub: ${String(r.error ?? res.status)}`)
  // Only GitHub's own page is opened
  const page =
    typeof r.verification_uri === 'string' && /^https:\/\/github\.com\//.test(r.verification_uri) ? r.verification_uri : 'https://github.com/login/device'
  const expiresIn = Number(r.expires_in) > 0 ? Number(r.expires_in) : 900
  device = { code: r.device_code, interval: Math.max(5, Number(r.interval) || 5), until: Date.now() + expiresIn * 1000, signal }
  return { userCode: r.user_code, verificationUri: page, expiresIn }
}

export function openGithubPage(): void {
  void shell.openExternal('https://github.com/login/device')
}

/** Waits for the user to enter the code on GitHub, then keeps the token: GitHub's login */
export async function githubWait(): Promise<{ login: string | null }> {
  const d = device
  if (!d) throw new Error('SIGN_IN_NOT_STARTED')
  try {
    let interval = d.interval
    for (;;) {
      await sleep(interval * 1000, d.signal)
      if (Date.now() > d.until) throw new Error('SIGN_IN_EXPIRED')
      const res = await form(
        githubTokenUrl(),
        { client_id: githubClientId(), device_code: d.code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' },
        d.signal
      )
      const r = (await res.json().catch(() => ({}))) as Record<string, unknown>
      if (typeof r.access_token === 'string' && r.access_token) {
        const saved = await saveGithubToken(r.access_token)
        log('info', 'github', 'Signed in through the browser')
        return saved
      }
      if (r.error === 'authorization_pending') continue
      // GitHub asks to wait longer: its new interval, else 5 s more
      if (r.error === 'slow_down') interval = Number(r.interval) > interval ? Number(r.interval) : interval + 5
      else if (r.error === 'expired_token' || r.error === 'token_expired') throw new Error('SIGN_IN_EXPIRED')
      else if (r.error === 'access_denied') throw new Error('SIGN_IN_DENIED')
      else throw new Error(`GitHub: ${String(r.error_description ?? r.error ?? res.status)}`)
    }
  } catch (err) {
    if (d.signal.aborted) throw new Error('CANCELLED', { cause: err })
    throw err
  } finally {
    if (device === d) device = null
  }
}

// ─── Vercel: the browser, with PKCE ──────────────────────────────────────────

const base64url = (b: Buffer) => b.toString('base64url')

/** The address the browser opens (tested) */
export function vercelAuthorizeUrl(clientId: string, challenge: string, state: string): string {
  const url = new URL(VERCEL_AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: LOOPBACK_URL,
    response_type: 'code',
    scope: VERCEL_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  }).toString()
  return url.toString()
}

/** Opens Vercel in the browser and waits for its answer on this PC (5 minutes at most) */
export async function vercelSignIn(): Promise<VercelAccount> {
  const clientId = vercelClientId()
  if (!clientId) throw new Error('SIGN_IN_UNAVAILABLE')
  const loop = openLoopback()
  const { signal } = begin()
  try {
    const verifier = base64url(randomBytes(32))
    const state = base64url(randomBytes(16))
    loop.expect(state)
    await shell.openExternal(vercelAuthorizeUrl(clientId, base64url(createHash('sha256').update(verifier).digest()), state))
    const cancelled = new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('CANCELLED')), { once: true }))
    const code = await Promise.race([loop.code, cancelled])
    const res = await form(
      vercelTokenUrl(),
      { grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: LOOPBACK_URL },
      signal
    )
    const t = (await res.json().catch(() => ({}))) as Partial<VercelTokens> & { error?: string; error_description?: string }
    if (!res.ok || typeof t.access_token !== 'string') throw new Error(`Vercel: ${t.error_description ?? t.error ?? res.status}`)
    return await saveVercelSession(t as VercelTokens)
  } finally {
    loop.stop()
  }
}
