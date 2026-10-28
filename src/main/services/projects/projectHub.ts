import { existsSync, readFileSync } from 'fs'
import { relative, resolve, sep } from 'path'
import { app } from 'electron'
import type { LinkKind, Project, ProjectHub } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { loadProjects } from './projectStorage'
import { findManifestDirs } from '../packages/npmPackages'
import { composeConfig, composeDirFor, composeName } from '../docker/composeProjects'
import { readEnvProject } from '../envfiles/envFiles'
import { listDbConnections } from '../database/dbStorage'
import { configDirs, fromEnv } from '../database/dbDetect'
import { groupContents } from './projectScanner'
import { listDomains } from '../domains/domainService'
import { listTargets } from '../deploy/deployService'
import { readLink } from '../vercel/vercelService'
import { repoOf } from '../github/githubService'
import { explicitPort, projectLogFiles, readEnvs } from '../suggest/suggestions'

/**
 * Everything that belongs to a project, found automatically and adjusted by
 * hand: compose folder, .env files, databases named in the .env, log files,
 * local domains on the project's ports, deploy targets.
 * Manual changes live in userData/project-links.json: an added resource is
 * kept, a found one the user unties is hidden (and can be shown again).
 */

type Links = Record<string, { add: Record<LinkKind, string[]>; hide: Record<LinkKind, string[]> }>

const KINDS: LinkKind[] = ['databases', 'logs', 'domains']
const linksPath = () => `${app.getPath('userData')}${sep}project-links.json`
const empty = () => ({ add: { databases: [], logs: [], domains: [] }, hide: { databases: [], logs: [], domains: [] } }) as Links[string]

function readLinks(): Links {
  if (!existsSync(linksPath())) return {}
  try { return JSON.parse(readFileSync(linksPath(), 'utf-8')) as Links } catch { return {} }
}

function linksOf(projectId: string): Links[string] {
  const l = readLinks()[projectId]
  const e = empty()
  return l ? { add: { ...e.add, ...l.add }, hide: { ...e.hide, ...l.hide } } : e
}

const inside = (root: string, path: string) => {
  const r = resolve(root).toLowerCase() + sep
  return resolve(path).toLowerCase().startsWith(r)
}

function projectById(id: string): Project {
  const p = loadProjects().find(x => x.id === id)
  if (!p) throw new Error('Unknown project')
  return p
}

/** Ports the project serves on: its config, then compose published ports */
async function projectPorts(p: Project, env: Record<string, string>, composeDir: string | null): Promise<{ port: number; source: string }[]> {
  const out = new Map<number, string>()
  const explicit = await explicitPort(p, env).catch(() => null)
  if (explicit) out.set(explicit[0], explicit[1])
  if (composeDir) {
    const cfg = await composeConfig(composeDir).catch(() => null)
    for (const [name, svc] of Object.entries(cfg?.services ?? {})) {
      for (const port of svc.ports ?? []) {
        const n = Number(port.published)
        if (n > 0 && !out.has(n)) out.set(n, `compose ${name}`)
      }
    }
  }
  return [...out].map(([port, source]) => ({ port, source })).sort((a, b) => a.port - b.port)
}

export async function getProjectHub(projectId: string): Promise<ProjectHub> {
  const p = projectById(projectId)
  const links = linksOf(projectId)
  const composeDir = composeDirFor(p.path)
  const [env, envProject, logs] = await Promise.all([readEnvs(p), readEnvProject(p.path).catch(() => ({ files: [] })), projectLogFiles(p)])
  const ports = await projectPorts(p, env, composeDir)

  // Databases: the one the .env describes, SQLite files inside the project, and manual ones
  // (a group: the .env of each of its projects)
  const envs = p.framework === 'group' ? await Promise.all((await configDirs(p)).map(d => readEnvs({ ...p, path: d.dir }))) : [env]
  const wanted = envs.map(fromEnv).filter(w => !!w)
  const autoDb = listDbConnections().filter(c =>
    (c.type === 'sqlite' && !!c.file && inside(p.path, c.file)) ||
    wanted.some(w => c.type === w.type && !!w.database && c.database === w.database && (!c.port || !w.port || c.port === w.port || !!c.sshConnectionId))
  ).map(c => c.id)
  const dbs = listDbConnections()
  const databases = [
    ...autoDb.filter(id => !links.hide.databases.includes(id)).map(id => ({ id, origin: 'auto' as const })),
    ...links.add.databases.filter(id => !autoDb.includes(id)).map(id => ({ id, origin: 'manual' as const }))
  ].flatMap(({ id, origin }) => { const c = dbs.find(x => x.id === id); return c ? [{ id, name: c.name, type: c.type, origin }] : [] })

  const autoLogs = logs.map(l => l.path)
  const logList = [
    ...logs.filter(l => !links.hide.logs.includes(l.path)).map(l => ({ path: l.path, size: l.size, modifiedAt: l.modifiedAt, origin: 'auto' as const })),
    ...links.add.logs.filter(path => !autoLogs.includes(path) && existsSync(path)).map(path => ({ path, size: 0, modifiedAt: '', origin: 'manual' as const }))
  ]

  const portSet = new Set(ports.map(x => x.port))
  const allDomains = listDomains()
  const autoDomains = allDomains.filter(d => portSet.has(d.port)).map(d => d.id)
  const domains = [
    ...autoDomains.filter(id => !links.hide.domains.includes(id)).map(id => ({ id, origin: 'auto' as const })),
    ...links.add.domains.filter(id => !autoDomains.includes(id)).map(id => ({ id, origin: 'manual' as const }))
  ].flatMap(({ id, origin }) => { const d = allDomains.find(x => x.id === id); return d ? [{ id, domain: d.domain, port: d.port, enabled: d.enabled, origin }] : [] })

  return {
    project: p.framework === 'group' ? { ...p, ...await groupContents(p.path) } : p,
    composeDir,
    composeName: composeDir ? composeName(composeDir) : null,
    envFiles: envProject.files.map(f => ({ name: f.name, keys: Object.keys(f.values).length })),
    databases,
    logs: logList,
    domains,
    ports,
    vercel: readLink(p.path),
    github: await repoOf(p.path).catch(() => null),
    deployTargets: listTargets().filter(t => t.projectPath && resolve(t.projectPath).toLowerCase() === resolve(p.path).toLowerCase()).map(t => ({ id: t.id, name: t.name })),
    manifests: [...new Set([...findManifestDirs(p.path), ...findManifestDirs(p.path, 'composer.json')].map(d => relative(p.path, d).split(sep).join('/')))],
    hidden: { databases: links.hide.databases, logs: links.hide.logs, domains: links.hide.domains }
  }
}

/** Ties or unties a resource. Untying a found one hides it; tying a hidden one shows it again */
export async function linkResource(projectId: string, kind: LinkKind, ref: string, linked: boolean): Promise<ProjectHub> {
  projectById(projectId)
  if (!KINDS.includes(kind) || typeof ref !== 'string' || !ref) throw new Error('Invalid link')
  const all = readLinks()
  const l = linksOf(projectId)
  const without = (list: string[]) => list.filter(x => x !== ref)
  if (linked) {
    l.hide[kind] = without(l.hide[kind])
    if (!l.add[kind].includes(ref)) l.add[kind] = [...l.add[kind], ref]
  } else {
    l.add[kind] = without(l.add[kind])
    if (!l.hide[kind].includes(ref)) l.hide[kind] = [...l.hide[kind], ref]
  }
  all[projectId] = l
  writeJsonFile(linksPath(), all)
  return getProjectHub(projectId)
}

// ─── Active project ───────────────────────────────────────────────────────────

const activePath = () => `${app.getPath('userData')}${sep}active-project.json`

export function getActiveProject(): string | null {
  try {
    const id = (JSON.parse(readFileSync(activePath(), 'utf-8')) as { id?: unknown }).id
    return typeof id === 'string' && loadProjects().some(p => p.id === id) ? id : null
  } catch { return null }
}

export function setActiveProject(id: string | null): void {
  if (id !== null) projectById(id)
  writeJsonFile(activePath(), { id })
}
