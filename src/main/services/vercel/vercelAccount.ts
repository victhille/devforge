import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { VercelAccountDeployment, VercelAccountDomain, VercelAccountProject, VercelScope, VercelScopes } from '@shared/types'
import { log } from '../../lib/log'
import { loadProjects } from '../projects/projectStorage'
import { ID_RE, branchOf, call, commitOf, fetchBuildLogs, projectPath, readLink } from './vercelService'

/**
 * The Vercel page: every project, deployment and domain of the personal account
 * or of one of its teams. The page's own writes are three: cancel a build,
 * promote a deployment, link a DevForge folder to a project (.vercel/project.json).
 */

/** A team id from the window, or null for the personal account */
function teamId(scope: VercelScope): string | null {
  if (scope === null) return null
  if (typeof scope !== 'string' || !scope.startsWith('team_') || !ID_RE.test(scope)) throw new Error('Invalid team')
  return scope
}

function id(value: string, what: string): string {
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new Error(`Invalid ${what}`)
  return value
}

export async function scopes(): Promise<VercelScopes> {
  const [me, t] = await Promise.all([
    call<{ user: { username: string } }>('/v2/user'),
    call<{ teams?: { id: string; name?: string; slug: string }[] }>('/v2/teams?limit=50').catch(() => ({ teams: [] }))
  ])
  return {
    username: me.user.username,
    teams: (t.teams ?? []).filter(x => ID_RE.test(x.id)).map(x => ({ id: x.id, name: x.name || x.slug, slug: x.slug }))
  }
}

interface RawLatest {
  uid?: string
  id?: string
  readyState?: string
  state?: string
  target?: string | null
  createdAt?: number
  created?: number
  meta?: Record<string, string>
}

/** Vercel project id → the DevForge project whose folder is linked to it */
function localLinks(): Map<string, { id: string; name: string }> {
  const map = new Map<string, { id: string; name: string }>()
  for (const p of loadProjects()) {
    const l = readLink(p.path)
    if (l && !map.has(l.projectId)) map.set(l.projectId, { id: p.id, name: p.name })
  }
  return map
}

interface RawProject {
  id: string
  name: string
  framework?: string | null
  targets?: { production?: { id?: string; alias?: string[] } }
  alias?: { domain: string }[]
  latestDeployments?: RawLatest[]
}

export async function accountProjects(scope: VercelScope): Promise<VercelAccountProject[]> {
  const r = await call<{ projects: RawProject[] }>('/v9/projects?limit=100', { teamId: teamId(scope) })
  const links = localLinks()
  return r.projects
    .filter(p => ID_RE.test(p.id))
    .map(p => {
      const alias = p.targets?.production?.alias?.[0] ?? p.alias?.[0]?.domain ?? null
      const d = [...(p.latestDeployments ?? [])].sort((a, b) => (b.createdAt ?? b.created ?? 0) - (a.createdAt ?? a.created ?? 0))[0]
      return {
        id: p.id,
        name: p.name,
        framework: p.framework ?? null,
        productionUrl: alias ? `https://${alias}` : null,
        latest: d
          ? {
              id: d.uid ?? d.id ?? '',
              state: d.readyState ?? d.state ?? 'UNKNOWN',
              target: d.target ?? null,
              createdAt: d.createdAt ?? d.created ?? 0,
              branch: branchOf(d.meta),
              commitMessage: commitOf(d.meta)
            }
          : null,
        local: links.get(p.id) ?? null
      }
    })
}

interface RawDeployment extends RawLatest {
  url: string
  name: string
  projectId?: string
  creator?: { username?: string }
}

export async function accountDeployments(scope: VercelScope): Promise<VercelAccountDeployment[]> {
  const team = teamId(scope)
  const [r, p] = await Promise.all([
    call<{ deployments: RawDeployment[] }>('/v6/deployments?limit=40', { teamId: team }),
    call<{ projects: RawProject[] }>('/v9/projects?limit=100', { teamId: team }).catch(() => ({ projects: [] as RawProject[] }))
  ])
  const current = new Set(p.projects.map(x => x.targets?.production?.id).filter(Boolean))
  const byName = new Map(p.projects.map(x => [x.name, x.id]))
  return r.deployments.map(d => {
    const uid = d.uid ?? d.id ?? ''
    return {
      id: uid,
      url: `https://${d.url}`,
      state: d.state ?? d.readyState ?? 'UNKNOWN',
      target: d.target ?? null,
      createdAt: d.created ?? d.createdAt ?? 0,
      branch: branchOf(d.meta),
      commitMessage: commitOf(d.meta),
      creator: d.creator?.username ?? null,
      current: current.has(uid),
      projectId: d.projectId ?? byName.get(d.name) ?? '',
      projectName: d.name
    }
  })
}

export async function accountDomains(scope: VercelScope): Promise<VercelAccountDomain[]> {
  const team = teamId(scope)
  const r = await call<{ domains: { name: string; verified?: boolean; boughtAt?: number | null; expiresAt?: number | null }[] }>('/v5/domains?limit=50', {
    teamId: team
  })
  return Promise.all(
    r.domains.map(async d => {
      const cfg = await call<{ misconfigured?: boolean }>(`/v6/domains/${encodeURIComponent(d.name)}/config`, { teamId: team }).catch(() => null)
      return {
        name: d.name,
        verified: d.verified ?? false,
        misconfigured: cfg?.misconfigured ?? null,
        boughtAtVercel: !!d.boughtAt,
        expiresAt: d.expiresAt ?? null
      }
    })
  )
}

export const accountBuildLogs = (scope: VercelScope, deploymentId: string): Promise<string> => fetchBuildLogs(teamId(scope), deploymentId)

export async function cancelDeployment(scope: VercelScope, deploymentId: string): Promise<void> {
  await call(`/v12/deployments/${id(deploymentId, 'deployment')}/cancel`, { method: 'PATCH', teamId: teamId(scope) })
  log('info', 'vercel', `Cancelled ${deploymentId}`)
}

export async function promoteIn(scope: VercelScope, vercelProjectId: string, deploymentId: string): Promise<void> {
  await call(`/v10/projects/${id(vercelProjectId, 'project')}/promote/${id(deploymentId, 'deployment')}`, { method: 'POST', teamId: teamId(scope) })
  log('info', 'vercel', `Promoted ${deploymentId}`)
}

/**
 * Links a DevForge project's folder to a Vercel project, as `vercel link` does:
 * .vercel/project.json, and `.vercel` in an existing .gitignore. A folder already
 * linked to another project is left alone.
 */
export async function linkProject(localProjectId: string, scope: VercelScope, vercelProjectId: string): Promise<void> {
  const team = teamId(scope)
  const dir = projectPath(localProjectId)
  const pid = id(vercelProjectId, 'project')
  const current = readLink(dir)
  if (current && current.projectId !== pid) throw new Error('ALREADY_LINKED')
  // The project must exist in this scope; the personal account's orgId is the user id
  const [p, me] = await Promise.all([
    call<{ id: string; name: string }>(`/v9/projects/${pid}`, { teamId: team }),
    team ? Promise.resolve(null) : call<{ user: { id: string } }>('/v2/user')
  ])
  const orgId = team ?? me?.user.id ?? ''
  if (p.id !== pid || !ID_RE.test(orgId)) throw new Error('Invalid project')
  mkdirSync(join(dir, '.vercel'), { recursive: true })
  writeFileSync(join(dir, '.vercel', 'project.json'), JSON.stringify({ projectId: pid, orgId, projectName: p.name }, null, 2) + '\n')
  const ignore = join(dir, '.gitignore')
  if (existsSync(ignore)) {
    const text = readFileSync(ignore, 'utf-8')
    if (!/^\/?\.vercel\/?\s*$/m.test(text)) writeFileSync(ignore, text + (text.endsWith('\n') || !text ? '' : '\n') + '.vercel\n')
  }
  log('info', 'vercel', `Linked a project folder to ${p.name}`)
}
