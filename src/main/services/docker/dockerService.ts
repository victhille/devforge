import { dirname } from 'path'
import type { ComposeProject, ContainerAction, DockerContainer, DockerImage, DockerOverview } from '@shared/types'
import { runFile } from '../../lib/exec'
import { processManager } from '../stacks/processManager'

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

  let projects: ComposeProject[] = []
  try {
    projects = (JSON.parse(compose.stdout || '[]') as RawCompose[]).map(p => ({ name: p.Name, status: p.Status, configFiles: p.ConfigFiles }))
  } catch { /* compose plugin missing */ }

  return { available: true, version: info.stdout.trim(), containers, images: imgs, compose: projects }
}

const ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

export async function containerAction(id: string, action: ContainerAction) {
  if (!ID_RE.test(id)) return { ok: false, output: 'Invalid container id' }
  const args = action === 'remove' ? ['rm', '-f', id] : [action, id]
  const r = await docker(args, 60_000)
  return { ok: r.ok, output: (r.stdout + r.stderr).trim() }
}

export async function composeAction(name: string, configFiles: string, action: 'up' | 'down' | 'restart') {
  if (!ID_RE.test(name)) return { ok: false, output: 'Invalid project name' }
  const files = configFiles.split(',').map(f => f.trim()).filter(Boolean)
  const args = ['compose', '-p', name, ...files.flatMap(f => ['-f', f])]
  const r = await runFile('docker', [...args, ...(action === 'up' ? ['up', '-d'] : [action])], {
    timeout: 300_000,
    cwd: files[0] ? dirname(files[0]) : undefined
  })
  return { ok: r.ok, output: (r.stdout + r.stderr).trim() }
}

export async function prune() {
  const r = await docker(['system', 'prune', '-f'], 300_000)
  return { ok: r.ok, output: (r.stdout + r.stderr).trim() }
}

const logKey = (id: string) => `docker:${id}`

export async function followLogs(id: string): Promise<string> {
  if (!ID_RE.test(id)) throw new Error('Invalid container id')
  const key = logKey(id)
  if (!processManager.isRunning(key)) processManager.start(key, `docker logs -f --tail 300 ${id}`, process.cwd())
  return key
}

export const stopLogs = (id: string) => processManager.stop(logKey(id))
