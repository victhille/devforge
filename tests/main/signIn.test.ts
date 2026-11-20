import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shell } from 'electron'
import { userData } from '../helpers'

process.env.DEVFORGE_TEST_GITHUB_CLIENT_ID = 'Iv1.test'
process.env.DEVFORGE_TEST_VERCEL_CLIENT_ID = 'cl_test'

const signIn = await import('../../src/main/services/connections/signIn')
const vercel = await import('../../src/main/services/vercel/vercelService')
const github = await import('../../src/main/services/github/githubService')
const { LOOPBACK_URL } = await import('../../src/main/lib/oauthLoopback')

const realFetch = globalThis.fetch
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
type Route = (url: string, body: URLSearchParams | null) => Response | Promise<Response> | undefined

/** Services answered by the test; anything else (the loopback on this PC) goes through for real */
function serve(route: Route): { calls: { url: string; body: URLSearchParams | null }[] } {
  const calls: { url: string; body: URLSearchParams | null }[] = []
  vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('http://127.0.0.1')) return realFetch(input, init)
    const body = init?.body instanceof URLSearchParams ? init.body : null
    calls.push({ url, body })
    return (await route(url, body)) ?? json({ message: 'unexpected ' + url }, 500)
  })
  return { calls }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Signing in without a token: GitHub's device flow and Vercel's PKCE, the token then kept encrypted */
describe('Sign in without a token', () => {
  it('says which services offer it', () => {
    expect(signIn.signInAvailable()).toEqual({ github: true, vercel: true })
  })

  it('GitHub: shows a code, waits while the user types it (slowing down when asked), then keeps the token', async () => {
    vi.useFakeTimers()
    let polls = 0
    const { calls } = serve(url => {
      if (url.endsWith('/login/device/code'))
        return json({ device_code: 'dev-1', user_code: 'WDJB-MJHT', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 })
      if (url.endsWith('/login/oauth/access_token')) {
        polls++
        if (polls === 1) return json({ error: 'authorization_pending' })
        if (polls === 2) return json({ error: 'slow_down', interval: 10 })
        return json({ access_token: 'gho_signed', token_type: 'bearer', scope: 'repo,read:org' })
      }
      if (url.endsWith('/user')) return json({ login: 'octocat' })
    })

    const code = await signIn.githubStart()
    expect(code).toEqual({ userCode: 'WDJB-MJHT', verificationUri: 'https://github.com/login/device', expiresIn: 900 })
    expect(calls[0].body?.get('client_id')).toBe('Iv1.test')
    expect(calls[0].body?.get('scope')).toBe('repo read:org')

    const waiting = signIn.githubWait()
    await vi.advanceTimersByTimeAsync(5_000) // pending
    await vi.advanceTimersByTimeAsync(5_000) // slow_down: 10 s from now on
    expect(polls).toBe(2)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(polls).toBe(2)
    await vi.advanceTimersByTimeAsync(5_000)
    expect(await waiting).toEqual({ login: 'octocat' })
    expect(calls.find(c => c.url.endsWith('/access_token'))?.body?.get('grant_type')).toBe('urn:ietf:params:oauth:grant-type:device_code')

    // Kept like a pasted token, never in clear
    expect(github.hasToken()).toBe(true)
    expect(readFileSync(join(userData(), 'github.json'), 'utf-8')).not.toContain('gho_signed')
    await github.saveToken(null)
  })

  it('GitHub: a refused access, an expired code and a cancel each end the wait', async () => {
    vi.useFakeTimers()
    let answer: Record<string, string> = { error: 'access_denied' }
    serve(url => {
      if (url.endsWith('/login/device/code'))
        return json({ device_code: 'dev-2', user_code: 'ABCD-EFGH', verification_uri: 'https://evil.example/device', interval: 5 })
      if (url.endsWith('/access_token')) return json(answer)
    })
    // Only GitHub's own page is shown
    expect((await signIn.githubStart()).verificationUri).toBe('https://github.com/login/device')
    let waiting = signIn.githubWait()
    const denied = expect(waiting).rejects.toThrow('SIGN_IN_DENIED')
    await vi.advanceTimersByTimeAsync(5_000)
    await denied

    answer = { error: 'expired_token' }
    await signIn.githubStart()
    waiting = signIn.githubWait()
    const expired = expect(waiting).rejects.toThrow('SIGN_IN_EXPIRED')
    await vi.advanceTimersByTimeAsync(5_000)
    await expired

    answer = { error: 'authorization_pending' }
    await signIn.githubStart()
    waiting = signIn.githubWait()
    const cancelled = expect(waiting).rejects.toThrow('CANCELLED')
    signIn.cancelSignIn()
    await cancelled
    await expect(signIn.githubWait()).rejects.toThrow('SIGN_IN_NOT_STARTED')
  })

  it('Vercel: the browser comes back to this PC with the state, the code is traded with its verifier, the token is renewed once', async () => {
    let renewals = 0
    const { calls } = serve((url, body) => {
      if (url.endsWith('/login/oauth/token') && body?.get('grant_type') === 'authorization_code')
        return json({ access_token: 'vca_first', refresh_token: 'vcr_first', expires_in: 3600, token_type: 'Bearer' })
      if (url.endsWith('/login/oauth/token') && body?.get('grant_type') === 'refresh_token') {
        renewals++
        return body.get('refresh_token') === 'vcr_first'
          ? json({ access_token: 'vca_second', refresh_token: 'vcr_second', expires_in: 3600 })
          : json({ error: 'invalid_grant' }, 400)
      }
      if (url.endsWith('/v2/user')) return json({ user: { username: 'ada' } })
    })
    let opened = ''
    vi.spyOn(shell, 'openExternal').mockImplementation(async (u: string) => {
      opened = u
    })

    const done = signIn.vercelSignIn()
    await vi.waitFor(() => expect(opened).not.toBe(''))
    const url = new URL(opened)
    expect(url.origin + url.pathname).toBe('https://vercel.com/oauth/authorize')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: 'cl_test',
      redirect_uri: LOOPBACK_URL,
      response_type: 'code',
      code_challenge_method: 'S256',
      scope: 'openid offline_access'
    })

    // Another page calling the port without the state is refused, the wait goes on
    expect((await realFetch(`${LOOPBACK_URL}?code=stolen&state=nope`)).status).toBe(400)
    expect((await realFetch(`${LOOPBACK_URL}?code=good&state=${url.searchParams.get('state')}`)).status).toBe(200)
    expect(await done).toEqual({ connected: true, username: 'ada', signedIn: true })

    const trade = calls.find(c => c.body?.get('grant_type') === 'authorization_code')!.body!
    expect(trade.get('code')).toBe('good')
    expect(trade.get('redirect_uri')).toBe(LOOPBACK_URL)
    const { createHash } = await import('crypto')
    expect(createHash('sha256').update(trade.get('code_verifier')!).digest('base64url')).toBe(url.searchParams.get('code_challenge'))
    const file = join(userData(), 'vercel.json')
    expect(readFileSync(file, 'utf-8')).not.toMatch(/vca_|vcr_/)

    // An hour later: two calls at once share one renewal (a refresh token works once)
    writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf-8')), expiresAt: Date.now() - 1 }))
    expect(await Promise.all([vercel.checkAccount(), vercel.checkAccount()])).toEqual(['ada', 'ada'])
    expect(renewals).toBe(1)
    const bearers = calls.filter(c => c.url.endsWith('/v2/user')).length
    expect(bearers).toBeGreaterThanOrEqual(3)
    await vercel.saveToken(null)
  })

  it('Vercel: a renewal never brings back a removed sign-in, keeps the refresh token when none comes, forgets a refused one', async () => {
    const file = join(userData(), 'vercel.json')
    // As safeStorage's stub writes it: its bytes, then base64
    const enc = (v: string) => Buffer.from('ENC:' + Buffer.from(v).toString('base64')).toString('base64')
    const signedIn = (refresh: string) =>
      writeFileSync(file, JSON.stringify({ tokenEnc: enc('vca_old'), username: 'ada', refreshEnc: enc(refresh), expiresAt: Date.now() - 1 }))
    let answer: () => Response = () => json({ access_token: 'vca_new', expires_in: 3600 })
    let removeMeanwhile = false
    serve(url => {
      if (url.endsWith('/login/oauth/token')) {
        if (removeMeanwhile) writeFileSync(file, '{}')
        return answer()
      }
      if (url.endsWith('/v2/user')) return json({ user: { username: 'ada' } })
    })

    // No refresh token in the answer: the one that worked stays
    signedIn('vcr_kept')
    expect(await vercel.checkAccount()).toBe('ada')
    const kept = JSON.parse(readFileSync(file, 'utf-8'))
    expect(kept.refreshEnc).toBe(enc('vcr_kept'))
    expect(kept.tokenEnc).toBe(enc('vca_new'))
    expect(kept.expiresAt).toBeGreaterThan(Date.now())

    // Removed while the renewal was under way: it stays removed
    signedIn('vcr_two')
    removeMeanwhile = true
    await vercel.checkAccount()
    expect(JSON.parse(readFileSync(file, 'utf-8'))).toEqual({})
    expect(vercel.account().connected).toBe(false)
    removeMeanwhile = false

    // Refused by Vercel: forgotten, a new sign-in is asked
    signedIn('vcr_dead')
    answer = () => json({ error: 'invalid_grant' }, 400)
    await expect(vercel.checkAccount()).rejects.toThrow('BAD_TOKEN')
    expect(vercel.account()).toEqual({ connected: false, username: null, signedIn: false })
  })

  it('Vercel: closing the panel cancels the wait and frees the port', async () => {
    serve(() => undefined)
    vi.spyOn(shell, 'openExternal').mockImplementation(async () => {})
    const done = signIn.vercelSignIn()
    const cancelled = expect(done).rejects.toThrow('CANCELLED')
    await new Promise(r => setTimeout(r, 50))
    signIn.cancelSignIn()
    await cancelled
    // The port is free for the next one
    const again = signIn.vercelSignIn()
    const second = expect(again).rejects.toThrow('CANCELLED')
    await new Promise(r => setTimeout(r, 50))
    signIn.cancelSignIn()
    await second
  })
})
