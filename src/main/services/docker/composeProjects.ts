import { existsSync, readFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { loadProjects } from '../projects/projectStorage'
import { runFile } from '../../lib/exec'

/** Files `docker compose` picks up by itself (an override next to them is merged too) */
const COMPOSE_FILES = ['compose.yaml', 'compose.yml', 'docker-compose.yml', 'docker-compose.yaml']

export function composeFileIn(dir: string): string | null {
  return COMPOSE_FILES.map(f => join(dir, f)).find(existsSync) ?? null
}

/**
 * Folder holding the compose file of a project: the project itself, or its
 * parent when the project is one part of a monorepo (e.g. `app/backend`).
 */
export function composeDirFor(projectPath: string): string | null {
  for (const dir of [projectPath, dirname(projectPath)]) if (composeFileIn(dir)) return dir
  return null
}

/** Compose project name: top-level `name:`, else the folder name, normalized like compose does */
export function composeName(dir: string): string {
  const file = composeFileIn(dir)
  const declared = file ? readFileSync(file, 'utf-8').match(/^name:\s*["']?([\w.-]+)/m)?.[1] : undefined
  return (declared ?? basename(dir)).toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

export interface LocalComposeProject { name: string; dir: string; projects: string[] }

/** Compose projects found in the saved DevForge projects */
export function localComposeProjects(): LocalComposeProject[] {
  const byDir = new Map<string, LocalComposeProject>()
  for (const p of loadProjects()) {
    const dir = composeDirFor(p.path)
    if (!dir) continue
    const prev = byDir.get(dir)
    if (prev) prev.projects.push(p.name)
    else byDir.set(dir, { name: composeName(dir), dir, projects: [p.name] })
  }
  return [...byDir.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export interface ComposeService {
  image?: string
  ports?: { target: number; published?: string; host_ip?: string }[]
  environment?: Record<string, string | null>
}

/** Fully resolved config (override files, .env variables, !override tags) */
export async function composeConfig(dir: string): Promise<{ name: string; services: Record<string, ComposeService> } | null> {
  const r = await runFile('docker', ['compose', 'config', '--format', 'json'], { cwd: dir, timeout: 15_000 })
  if (!r.ok) return null
  try { return JSON.parse(r.stdout) } catch { return null }
}
