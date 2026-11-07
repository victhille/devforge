import { existsSync } from 'fs'
import { dirname } from 'path'
import type { ComposeAction, ComposeProject, ComposeTarget, ContainerAction, ContainerStats, DockerContainer, DockerImage, DockerOverview } from '@shared/types'
import { runFile } from '../../lib/exec'
import { processManager } from '../stacks/processManager'
import { composeConfig, localComposeProjects } from './composeProjects'

const docker = (args: string[], timeout = 15_000) => runFile('docker', args, { timeout })

/** `--format '{{json .}}'` prints one JSON object per line */
function jsonLines<T>(out: string): T[] {
  return out.split('\n').filter(l => l.trim().startsWith('{')).map(l => JSON.parse(l) as T)
}

interface RawContainer { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string; Labels: string; CreatedAt: string }
interface RawImage { ID: string; Repository: string; Tag: string; Size: string; CreatedSince: string }
interface RawCompose { Name: string; Status: string; ConfigFiles: string }

export async function getOverview(): Promise<DockerOverview> {
  const info = await docker(['version', '--format', '{{.Server.Version}}'], 8000)
  if (!info.ok) {
    return { available: false, error: (info.stderr || info.stdout).trim().split('\n')[0], containers: [], images: [], compose: [] }
  }

  const [ps, images, compose] = await Promise.all([
    docker(['ps', '-a', '--no-trunc', '--format', '{{json .}}']),
    docker(['images', '--format', '{{json .}}']),
    docker(['compose', 'ls', '-a', '--format', 'json'])
  ])

  const containers: DockerContainer[] = jsonLines<RawContainer>(ps.stdout).map(c => ({
    id: c.ID.slice(0, 12),
    name: c.Names,
    image: c.Image,
    state: c.State,
    status: c.Status,
    ports: c.Ports,
    composeProject: c.Labels?.match(/com\.docker\.compose\.project=([^,]+)/)?.[1] ?? null,
    createdAt: c.CreatedAt
  }))

  const imgs: DockerImage[] = jsonLines<RawImage>(images.stdout).map(i => ({
    id: i.ID.replace(/^sha256:/, '').slice(0, 12),
    repository: i.Repository,
    tag: i.Tag,
    size: i.Size,
    createdSince: i.CreatedSince
  }))

  const count = (name: string) => {
    const own = containers.filter(c => c.composeProject === name)
    return { running: own.filter(c => c.state === 'running').length, total: own.length }
  }
  let known: RawCompose[] = []
  try { known = JSON.parse(compose.stdout || '[]') as RawCompose[] } catch { /* compose plugin missing */ }

  // Compose projects of DevForge projects first: they can be started even when
  // no container exists yet (never started, or removed)
  const locals = localComposeProjects()
  const configs = await Promise.all(locals.map(l => composeConfig(l.dir)))
  const projects: ComposeProject[] = locals.map((l, i) => ({
    name: l.name, dir: l.dir, projects: l.projects,
    services: Object.keys(configs[i]?.services ?? {}),
    status: known.find(k => k.Name === l.name)?.Status ?? '',
    configFiles: known.find(k => k.Name === l.name)?.ConfigFiles ?? '',
    ...count(l.name)
  }))
  for (const k of known) {
    if (!projects.some(p => p.name === k.Name)) projects.push({ name: k.Name, status: k.Status, configFiles: k.ConfigFiles, ...count(k.Name) })
  }

  return { available: true, version: info.stdout.trim(), containers, images: imgs, compose: projects }
}

const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

/** CPU and memory of running containers (`docker stats` takes ~2 s: asked apart from the overview) */
export async function containerStats(ids: string[]): Promise<Record<string, ContainerStats>> {
  const wanted = ids.filter(id => ID_RE.test(id)).slice(0, 50)
  if (!wanted.length) return {}
  const r = await docker(['stats', '--no-stream', '--format', '{{json .}}', ...wanted], 20_000)
  const out: Record<string, ContainerStats> = {}
  for (const s of jsonLines<{ ID: string; CPUPerc: string; MemUsage: string; MemPerc: string }>(r.stdout)) {
    out[s.ID.slice(0, 12)] = { cpu: parseFloat(s.CPUPerc) || 0, memory: s.MemUsage.split('/')[0].trim(), memoryPct: parseFloat(s.MemPerc) || 0 }
  }
  return out
}

export async function containerAction(id: string, action: ContainerAction) {
  if (!ID_RE.test(id)) return { ok: false, output: 'Invalid container id' }
  const args = action === 'remove' ? ['rm', '-f', id] : [action, id]
  const r = await docker(args, 60_000)
  return { ok: r.ok, output: (r.stdout + r.stderr).trim() }
}

/**
 * `docker compose` arguments and folder for a project. A DevForge project runs
 * in its folder (compose reads the override and .env files by itself); others
 * reuse the files `docker compose ls` reported.
 */
function composeCall(target: ComposeTarget): { args: string[]; cwd?: string } {
  if (!ID_RE.test(target.name)) throw new Error('Invalid project name')
  if (target.dir) {
    // Only folders DevForge found itself
    const local = localComposeProjects().find(l => l.dir === target.dir)
    if (!local) throw new Error('Unknown compose project')
    return { args: ['compose'], cwd: local.dir }
  }
  // Files deleted with their folder (a project removed with its containers still up): by its name
  // alone, compose still stops, removes and shows the logs of what runs (cwd in a missing folder: ENOENT)
  const files = target.configFiles.split(',').map(f => f.trim()).filter(f => f && existsSync(f))
  return { args: ['compose', '-p', target.name, ...files.flatMap(f => ['-f', f])], cwd: files[0] ? dirname(files[0]) : undefined }
}

const COMPOSE_ARGS: Record<ComposeAction, string[]> = { up: ['up', '-d'], stop: ['stop'], restart: ['restart'], down: ['down'] }

export async function composeAction(target: ComposeTarget, action: ComposeAction) {
  let call: ReturnType<typeof composeCall>
  try { call = composeCall(target) } catch (err) { return { ok: false, output: (err as Error).message } }
  // `up` may build images: allow a long time
  const r = await runFile('docker', [...call.args, ...COMPOSE_ARGS[action]], { timeout: 900_000, cwd: call.cwd })
  return { ok: r.ok, output: (r.stdout + r.stderr).trim() }
}

const composeLogKey = (name: string) => `compose:${name}`

export async function followComposeLogs(target: ComposeTarget): Promise<string> {
  const call = composeCall(target)
  const key = composeLogKey(target.name)
  const files = call.args.slice(1).map(a => (a.startsWith('-') ? a : `"${a}"`)).join(' ')
  if (!processManager.isRunning(key)) {
    processManager.start(key, `docker compose ${files ? files + ' ' : ''}logs -f --tail 200`,call.cwd ?? process.cwd())
  }
  return key
}

export const stopComposeLogs = (name: string) => processManager.stop(composeLogKey(name))

/**
 * Like `docker system prune`, but containers of Compose projects are kept:
 * a stopped project must stay startable (its containers hold its state).
 */
export async function prune() {
  const steps = [
    ['container', 'prune', '-f', '--filter', 'label!=com.docker.compose.project'],
    ['image', 'prune', '-f'],
    ['network', 'prune', '-f'],
    ['builder', 'prune', '-f']
  ]
  let output = ''
  for (const args of steps) {
    const r = await docker(args, 300_000)
    output += (r.stdout + r.stderr).trim() + '\n'
    if (!r.ok) return { ok: false, output: output.trim() }
  }
  return { ok: true, output: output.trim() }
}

const logKey = (id: string) => `docker:${id}`

export async function followLogs(id: string): Promise<string> {
  if (!ID_RE.test(id)) throw new Error('Invalid container id')
  const key = logKey(id)
  if (!processManager.isRunning(key)) processManager.start(key, `docker logs -f --tail 300 ${id}`, process.cwd())
  return key
}

export const stopLogs = (id: string) => processManager.stop(logKey(id))
