import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { VercelAccount, VercelDeployment, VercelDomain, VercelEnvDiff, VercelLink, VercelProjectInfo } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log, redact } from '../../lib/log'
import { loadProjects } from '../projects/projectStorage'
import { parseEnv } from '../envfiles/envFiles'
import { vercelClientId, vercelTokenUrl } from '../connections/oauthApps'

/**
 * Vercel, read and driven from the project page. A personal access token, or
 * the sign-in in the browser (renewed every hour), encrypted like the other secrets; the link between a
 * folder and its Vercel project is `.vercel/project.json` (`vercel link`).
 * Environment values are never read: only key names are compared.
 */

// End-to-end tests point both at a local fake (never in the installed app)
const API = !app.isPackaged && process.env.DEVFORGE_TEST_VERCEL_API ? process.env.DEVFORGE_TEST_VERCEL_API : 'https://api.vercel.com'
const testToken = () => (!app.isPackaged && process.env.DEVFORGE_TEST_VERCEL_TOKEN) || null
export const ID_RE = /^[\w-]{1,80}$/

interface Stored {
  tokenEnc?: string
  username?: string
  /** Signed in through the browser: the token lasts an hour, this one renews it (used once each) */
  refreshEnc?: string
  expiresAt?: number
}
const storePath = () => join(app.getPath('userData'), 'vercel.json')
function readStore(): Stored {
  try {
    return JSON.parse(readFileSync(storePath(), 'utf-8')) as Stored
  } catch {
    return {}
  }
}

export function account(): VercelAccount {
  if (testToken()) return { connected: true, username: 'test', signedIn: false }
  const s = readStore()
  return { connected: !!s.tokenEnc, username: s.tokenEnc ? (s.username ?? null) : null, signedIn: !!(s.tokenEnc && s.refreshEnc) }
}

const encrypt = (v: string) => safeStorage.encryptString(v).toString('base64')
const decrypt = (v: string) => safeStorage.decryptString(Buffer.from(v, 'base64'))

/** What the token endpoint gives on a sign-in or a renewal */
export interface VercelTokens {
  access_token: string
  refresh_token?: string
  expires_in?: number
}

let renewing: Promise<string> | null = null

const stored = (t: VercelTokens, username?: string, keptRefresh?: string): Stored => {
  const refreshEnc = t.refresh_token ? encrypt(t.refresh_token) : keptRefresh
  return { tokenEnc: encrypt(t.access_token), username, refreshEnc, expiresAt: refreshEnc ? Date.now() + (t.expires_in ?? 3600) * 1000 : undefined }
}

/**
 * A refresh token works once: two calls at the same time share one renewal. What it gives is kept only
 * if the sign-in is still the same (not removed, replaced by a pasted token or a new sign-in meanwhile).
 */
function renew(refreshEnc: string): Promise<string> {
  renewing ??= (async () => {
    const same = () => readStore().refreshEnc === refreshEnc
    try {
      const res = await fetch(vercelTokenUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decrypt(refreshEnc), client_id: vercelClientId() }),
        signal: AbortSignal.timeout(20_000)
      })
      const t = res.ok ? ((await res.json().catch(() => ({}))) as Partial<VercelTokens>) : {}
      if (typeof t.access_token !== 'string' || !t.access_token) {
        // Refused (revoked, 30 days unused): forgotten, the row asks for a new sign-in
        if (res.status >= 400 && res.status < 500 && same()) writeJsonFile(storePath(), {})
        throw new Error('BAD_TOKEN')
      }
      if (same()) {
        const now = readStore()
        // No new refresh token in the answer: the one that worked is kept
        writeJsonFile(storePath(), stored(t as VercelTokens, now.username, t.refresh_token ? undefined : refreshEnc))
      }
      return t.access_token
    } finally {
      renewing = null
    }
  })()
  return renewing
}

async function token(): Promise<string> {
  const test = testToken()
  if (test) return test
  const s = readStore()
  if (!s.tokenEnc) throw new Error('NO_TOKEN')
  // Renewed a minute before it ends
  if (s.refreshEnc && (s.expiresAt ?? 0) - 60_000 < Date.now()) return renew(s.refreshEnc)
  return decrypt(s.tokenEnc)
}

export async function call<T>(path: string, init: { method?: string; body?: unknown; teamId?: string | null; bearer?: string } = {}): Promise<T> {
  const url = new URL(API + path)
  if (init.teamId) url.searchParams.set('teamId', init.teamId)
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${init.bearer ?? (await token())}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000)
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text
    } catch {
      /* text */
    }
    throw new Error(res.status === 401 || res.status === 403 ? 'BAD_TOKEN' : `Vercel ${res.status}: ${msg.slice(0, 200)}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

/** The saved token still works: the account's username */
export async function checkAccount(): Promise<string> {
  return (await call<{ user: { username: string } }>('/v2/user')).user.username
}

export async function saveToken(raw: string | null): Promise<VercelAccount> {
  if (!raw?.trim()) {
    writeJsonFile(storePath(), {})
    return account()
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
  const t = raw.trim()
  const me = await call<{ user: { username: string } }>('/v2/user', { bearer: t })
  writeJsonFile(storePath(), { tokenEnc: encrypt(t), username: me.user.username })
  log('info', 'vercel', `Connected as ${me.user.username}`)
  return account()
}

/** The sign-in in the browser gave its tokens: checked, then kept like a pasted one */
export async function saveSession(t: VercelTokens): Promise<VercelAccount> {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
  const me = await call<{ user: { username: string } }>('/v2/user', { bearer: t.access_token })
  writeJsonFile(storePath(), stored(t, me.user.username))
  log('info', 'vercel', `Signed in as ${me.user.username}`)
  return account()
}

// ─── Project link ─────────────────────────────────────────────────────────────

export function projectPath(projectId: string): string {
  const p = loadProjects().find(x => x.id === projectId)
  if (!p) throw new Error('Unknown project')
  return p.path
}

export function readLink(dir: string): VercelLink | null {
  try {
    const j = JSON.parse(readFileSync(join(dir, '.vercel', 'project.json'), 'utf-8')) as Partial<VercelLink>
    return typeof j.projectId === 'string' && typeof j.orgId === 'string' && ID_RE.test(j.projectId) && ID_RE.test(j.orgId)
      ? { projectId: j.projectId, orgId: j.orgId }
      : null
  } catch {
    return null
  }
}

/** Team-owned projects need ?teamId=; a personal account's orgId is the user id */
const teamOf = (l: VercelLink) => (l.orgId.startsWith('team_') ? l.orgId : null)

function linkOf(projectId: string): VercelLink {
  const l = readLink(projectPath(projectId))
  if (!l) throw new Error('NOT_LINKED')
  return l
}

interface RawProject {
  name: string
  framework?: string | null
  targets?: { production?: { id?: string; alias?: string[] } }
  alias?: { domain: string }[]
}

export async function projectInfo(projectId: string): Promise<VercelProjectInfo | null> {
  const link = readLink(projectPath(projectId))
  if (!link) return null
  const p = await call<RawProject>(`/v9/projects/${link.projectId}`, { teamId: teamOf(link) })
  const alias = p.targets?.production?.alias?.[0] ?? p.alias?.[0]?.domain ?? null
  return { link, name: p.name, framework: p.framework ?? null, productionUrl: alias ? `https://${alias}` : null }
}

// ─── Deployments ──────────────────────────────────────────────────────────────

interface RawDeployment {
  uid: string
  url: string
  state?: string
  readyState?: string
  target?: string | null
  created?: number
  createdAt?: number
  meta?: Record<string, string>
  creator?: { username?: string }
}

export async function deployments(projectId: string): Promise<VercelDeployment[]> {
  const link = linkOf(projectId)
  const team = teamOf(link)
  const [r, p] = await Promise.all([
    call<{ deployments: RawDeployment[] }>(`/v6/deployments?projectId=${link.projectId}&limit=20`, { teamId: team }),
    call<RawProject>(`/v9/projects/${link.projectId}`, { teamId: team }).catch(() => null)
  ])
  const current = p?.targets?.production?.id ?? null
  return r.deployments.map(d => ({
    id: d.uid,
    url: `https://${d.url}`,
    state: d.state ?? d.readyState ?? 'UNKNOWN',
    target: d.target ?? null,
    createdAt: d.created ?? d.createdAt ?? 0,
    branch: branchOf(d.meta),
    commitMessage: commitOf(d.meta),
    creator: d.creator?.username ?? null,
    current: d.uid === current
  }))
}

/** The branch and the first line of the commit message, whatever the Git host */
export const branchOf = (meta?: Record<string, string>) => meta?.githubCommitRef ?? meta?.gitlabCommitRef ?? meta?.bitbucketCommitRef ?? null
export const commitOf = (meta?: Record<string, string>) =>
  (meta?.githubCommitMessage ?? meta?.gitlabCommitMessage ?? meta?.bitbucketCommitMessage ?? null)?.split('\n')[0] ?? null

/**
 * A deployment's build log, its last 60 000 characters. What a build prints may hold a secret
 * (an echoed variable, a URL with a password): it is masked, as in DevForge's own log, since
 * the text is shown and can be handed to Forgy.
 */
export async function fetchBuildLogs(teamId: string | null, deploymentId: string): Promise<string> {
  if (!ID_RE.test(deploymentId)) throw new Error('Invalid deployment')
  const events = await call<{ text?: string; payload?: { text?: string } }[]>(`/v3/deployments/${deploymentId}/events?builds=1&limit=-1`, { teamId })
  return redact(
    (Array.isArray(events) ? events : [])
      .map(e => e.payload?.text ?? e.text ?? '')
      .filter(Boolean)
      .join('\n')
      .slice(-60_000)
  )
}

export async function buildLogs(projectId: string, deploymentId: string): Promise<string> {
  return fetchBuildLogs(teamOf(linkOf(projectId)), deploymentId)
}

export async function redeploy(projectId: string, deploymentId: string): Promise<VercelDeployment> {
  if (!ID_RE.test(deploymentId)) throw new Error('Invalid deployment')
  const link = linkOf(projectId)
  const team = teamOf(link)
  const source = (await deployments(projectId)).find(d => d.id === deploymentId)
  if (!source) throw new Error('Unknown deployment')
  const p = await call<RawProject>(`/v9/projects/${link.projectId}`, { teamId: team })
  const d = await call<RawDeployment & { id?: string }>('/v13/deployments?forceNew=1', {
    method: 'POST',
    teamId: team,
    body: { name: p.name, deploymentId, project: link.projectId, ...(source.target === 'production' ? { target: 'production' } : {}) }
  })
  log('info', 'vercel', `Redeploy of ${deploymentId} → ${d.id ?? d.uid}`)
  return {
    id: d.id ?? d.uid,
    url: `https://${d.url}`,
    state: d.readyState ?? d.state ?? 'QUEUED',
    target: source.target,
    createdAt: Date.now(),
    branch: source.branch,
    commitMessage: source.commitMessage,
    creator: null,
    current: false
  }
}

export async function promote(projectId: string, deploymentId: string): Promise<void> {
  if (!ID_RE.test(deploymentId)) throw new Error('Invalid deployment')
  const link = linkOf(projectId)
  await call(`/v10/projects/${link.projectId}/promote/${deploymentId}`, { method: 'POST', teamId: teamOf(link) })
  log('info', 'vercel', `Promoted ${deploymentId}`)
}

// ─── Env keys and domains ─────────────────────────────────────────────────────

const LOCAL_ENV = ['.env.local', '.env', '.env.production.local', '.env.production']

export function compareEnv(remote: { key: string; targets: string[] }[], local: string[]): Pick<VercelEnvDiff, 'missingRemote' | 'missingLocal'> {
  const r = new Set(remote.map(e => e.key))
  const l = new Set(local)
  return { missingRemote: [...l].filter(k => !r.has(k)).sort(), missingLocal: [...r].filter(k => !l.has(k)).sort() }
}

export async function envDiff(projectId: string): Promise<VercelEnvDiff> {
  const dir = projectPath(projectId)
  const link = linkOf(projectId)
  const r = await call<{ envs: { key: string; target?: string[] | string }[] }>(`/v10/projects/${link.projectId}/env`, { teamId: teamOf(link) })
  const byKey = new Map<string, Set<string>>()
  for (const e of r.envs) {
    const targets = Array.isArray(e.target) ? e.target : e.target ? [e.target] : []
    byKey.set(e.key, new Set([...(byKey.get(e.key) ?? []), ...targets]))
  }
  const remote = [...byKey].map(([key, t]) => ({ key, targets: [...t].sort() })).sort((a, b) => a.key.localeCompare(b.key))
  const localFile = LOCAL_ENV.find(f => existsSync(join(dir, f))) ?? null
  const local = localFile ? Object.keys(parseEnv(readFileSync(join(dir, localFile), 'utf-8'))) : []
  return { remote, localFile, ...compareEnv(remote, local) }
}

export async function domains(projectId: string): Promise<VercelDomain[]> {
  const link = linkOf(projectId)
  const team = teamOf(link)
  const r = await call<{ domains: { name: string; verified: boolean; redirect?: string | null }[] }>(`/v9/projects/${link.projectId}/domains`, { teamId: team })
  return Promise.all(
    r.domains.map(async d => {
      const cfg = await call<{ misconfigured?: boolean }>(`/v6/domains/${encodeURIComponent(d.name)}/config`, { teamId: team }).catch(() => null)
      return { name: d.name, verified: d.verified, redirect: d.redirect ?? null, misconfigured: cfg?.misconfigured ?? null }
    })
  )
}
