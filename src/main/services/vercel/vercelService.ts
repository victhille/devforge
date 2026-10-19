import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { VercelAccount, VercelDeployment, VercelDomain, VercelEnvDiff, VercelLink, VercelProjectInfo } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { loadProjects } from '../projects/projectStorage'
import { parseEnv } from '../envfiles/envFiles'

/**
 * Vercel, read and driven from the project page. A personal access token
 * (encrypted like the other secrets) is the only sign-in; the link between a
 * folder and its Vercel project is `.vercel/project.json` (`vercel link`).
 * Environment values are never read: only key names are compared.
 */

const API = 'https://api.vercel.com'
const ID_RE = /^[\w-]{1,80}$/

interface Stored { tokenEnc?: string; username?: string }
const storePath = () => join(app.getPath('userData'), 'vercel.json')
function readStore(): Stored {
  try { return JSON.parse(readFileSync(storePath(), 'utf-8')) as Stored } catch { return {} }
}

export function account(): VercelAccount {
  const s = readStore()
  return { connected: !!s.tokenEnc, username: s.tokenEnc ? s.username ?? null : null }
}

function token(): string {
  const enc = readStore().tokenEnc
  if (!enc) throw new Error('NO_TOKEN')
  return safeStorage.decryptString(Buffer.from(enc, 'base64'))
}

async function call<T>(path: string, init: { method?: string; body?: unknown; teamId?: string | null; bearer?: string } = {}): Promise<T> {
  const url = new URL(API + path)
  if (init.teamId) url.searchParams.set('teamId', init.teamId)
  const res = await fetch(url, {
    method: init.method ?? 'GET',
    headers: { authorization: `Bearer ${init.bearer ?? token()}`, ...(init.body ? { 'content-type': 'application/json' } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000)
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try { msg = (JSON.parse(text) as { error?: { message?: string } }).error?.message ?? text } catch { /* text */ }
    throw new Error(res.status === 401 || res.status === 403 ? 'BAD_TOKEN' : `Vercel ${res.status}: ${msg.slice(0, 200)}`)
  }
  return (text ? JSON.parse(text) : {}) as T
}

export async function saveToken(raw: string | null): Promise<VercelAccount> {
  if (!raw?.trim()) { writeJsonFile(storePath(), {}); return account() }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
  const t = raw.trim()
  const me = await call<{ user: { username: string } }>('/v2/user', { bearer: t })
  writeJsonFile(storePath(), { tokenEnc: safeStorage.encryptString(t).toString('base64'), username: me.user.username })
  log('info', 'vercel', `Connected as ${me.user.username}`)
  return account()
}

// ─── Project link ─────────────────────────────────────────────────────────────

function projectPath(projectId: string): string {
  const p = loadProjects().find(x => x.id === projectId)
  if (!p) throw new Error('Unknown project')
  return p.path
}

export function readLink(dir: string): VercelLink | null {
  try {
    const j = JSON.parse(readFileSync(join(dir, '.vercel', 'project.json'), 'utf-8')) as Partial<VercelLink>
    return typeof j.projectId === 'string' && typeof j.orgId === 'string' && ID_RE.test(j.projectId) && ID_RE.test(j.orgId) ? { projectId: j.projectId, orgId: j.orgId } : null
  } catch { return null }
}

/** Team-owned projects need ?teamId=; a personal account's orgId is the user id */
const teamOf = (l: VercelLink) => (l.orgId.startsWith('team_') ? l.orgId : null)

function linkOf(projectId: string): VercelLink {
  const l = readLink(projectPath(projectId))
  if (!l) throw new Error('NOT_LINKED')
  return l
}

interface RawProject { name: string; framework?: string | null; targets?: { production?: { id?: string; alias?: string[] } }; alias?: { domain: string }[] }

export async function projectInfo(projectId: string): Promise<VercelProjectInfo | null> {
  const link = readLink(projectPath(projectId))
  if (!link) return null
  const p = await call<RawProject>(`/v9/projects/${link.projectId}`, { teamId: teamOf(link) })
  const alias = p.targets?.production?.alias?.[0] ?? p.alias?.[0]?.domain ?? null
  return { link, name: p.name, framework: p.framework ?? null, productionUrl: alias ? `https://${alias}` : null }
}

// ─── Deployments ──────────────────────────────────────────────────────────────

interface RawDeployment {
  uid: string; url: string; state?: string; readyState?: string; target?: string | null; created?: number; createdAt?: number
  meta?: Record<string, string>; creator?: { username?: string }
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
    branch: d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? d.meta?.bitbucketCommitRef ?? null,
    commitMessage: (d.meta?.githubCommitMessage ?? d.meta?.gitlabCommitMessage ?? d.meta?.bitbucketCommitMessage ?? null)?.split('\n')[0] ?? null,
    creator: d.creator?.username ?? null,
    current: d.uid === current
  }))
}

export async function buildLogs(projectId: string, deploymentId: string): Promise<string> {
  if (!ID_RE.test(deploymentId)) throw new Error('Invalid deployment')
  const link = linkOf(projectId)
  const events = await call<{ type?: string; created?: number; text?: string; payload?: { text?: string } }[]>(
    `/v3/deployments/${deploymentId}/events?builds=1&limit=-1`, { teamId: teamOf(link) })
  return (Array.isArray(events) ? events : [])
    .map(e => e.payload?.text ?? e.text ?? '')
    .filter(Boolean)
    .join('\n')
    .slice(-60_000)
}

export async function redeploy(projectId: string, deploymentId: string): Promise<VercelDeployment> {
  if (!ID_RE.test(deploymentId)) throw new Error('Invalid deployment')
  const link = linkOf(projectId)
  const team = teamOf(link)
  const source = (await deployments(projectId)).find(d => d.id === deploymentId)
  if (!source) throw new Error('Unknown deployment')
  const p = await call<RawProject>(`/v9/projects/${link.projectId}`, { teamId: team })
  const d = await call<RawDeployment & { id?: string }>('/v13/deployments?forceNew=1', {
    method: 'POST', teamId: team,
    body: { name: p.name, deploymentId, project: link.projectId, ...(source.target === 'production' ? { target: 'production' } : {}) }
  })
  log('info', 'vercel', `Redeploy of ${deploymentId} → ${d.id ?? d.uid}`)
  return { id: d.id ?? d.uid, url: `https://${d.url}`, state: d.readyState ?? d.state ?? 'QUEUED', target: source.target, createdAt: Date.now(), branch: source.branch, commitMessage: source.commitMessage, creator: null, current: false }
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
  return Promise.all(r.domains.map(async d => {
    const cfg = await call<{ misconfigured?: boolean }>(`/v6/domains/${encodeURIComponent(d.name)}/config`, { teamId: team }).catch(() => null)
    return { name: d.name, verified: d.verified, redirect: d.redirect ?? null, misconfigured: cfg?.misconfigured ?? null }
  }))
}
