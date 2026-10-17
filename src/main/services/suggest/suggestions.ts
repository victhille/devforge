import { readdir, readFile, stat } from 'fs/promises'
import { join } from 'path'
import type { DomainSuggestion, LogFileSuggestion, Project, UrlSuggestion } from '@shared/types'
import { loadProjects } from '../projects/projectStorage'
import { parseEnv } from '../envfiles/envFiles'
import { listDomains } from '../domains/domainService'
import { listMonitors } from '../monitor/urlMonitor'
import { getListeningPorts } from '../system/portService'
import { run } from '../../lib/exec'

/** Folders where frameworks write their logs */
const LOG_DIRS = ['storage/logs', 'var/log', 'logs', 'log', 'tmp/logs', '.']

async function readEnvs(p: Project): Promise<Record<string, string>> {
  const merged: Record<string, string> = {}
  for (const name of ['.env', '.env.local']) {
    const content = await readFile(join(p.path, name), 'utf-8').catch(() => null)
    if (content) Object.assign(merged, parseEnv(content))
  }
  return merged
}

export async function suggestLogFiles(): Promise<LogFileSuggestion[]> {
  const out: LogFileSuggestion[] = []
  await Promise.all(loadProjects().map(async p => {
    for (const dir of LOG_DIRS) {
      const full = join(p.path, dir)
      const names = await readdir(full).catch(() => [] as string[])
      for (const name of names.filter(n => /\.log$/i.test(n))) {
        const s = await stat(join(full, name)).catch(() => null)
        if (s?.isFile()) out.push({ projectName: p.name, path: join(full, name), size: s.size, modifiedAt: s.mtime.toISOString() })
      }
    }
  }))
  return out.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, 40)
}

const URL_KEYS = ['APP_URL', 'SITE_URL', 'PUBLIC_URL', 'FRONTEND_URL', 'BASE_URL', 'NEXT_PUBLIC_SITE_URL', 'NEXT_PUBLIC_APP_URL', 'NEXTAUTH_URL', 'VITE_APP_URL', 'VITE_API_URL', 'API_URL']

export async function suggestMonitorUrls(): Promise<UrlSuggestion[]> {
  const known = new Set(listMonitors().map(m => m.url.replace(/\/$/, '')))
  const out = new Map<string, UrlSuggestion>()
  const add = (s: UrlSuggestion) => {
    const key = s.url.replace(/\/$/, '')
    if (!known.has(key) && !out.has(key)) out.set(key, s)
  }

  for (const d of listDomains().filter(x => x.enabled)) {
    add({ name: d.domain, url: `http://${d.domain}`, source: 'local domain' })
  }
  await Promise.all(loadProjects().map(async p => {
    const env = await readEnvs(p)
    for (const k of URL_KEYS) {
      const v = env[k]
      // Public URLs only: localhost ones are covered by local domains
      if (v && /^https?:\/\/[^/]+\.[a-z]{2,}/i.test(v) && !/localhost|127\.0\.0\.1|\.test\b|\.local\b/i.test(v)) {
        add({ name: `${p.name} (${k})`, url: v, source: `${p.name}/.env ${k}` })
      }
    }
  }))
  return [...out.values()]
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Port written in the project config: .env, package.json scripts, vite/next config */
async function explicitPort(p: Project, env: Record<string, string>): Promise<[number, string] | null> {
  for (const k of ['PORT', 'APP_PORT', 'SERVER_PORT', 'DEV_PORT', 'VITE_PORT']) {
    if (Number(env[k]) > 0) return [Number(env[k]), `.env ${k}`]
  }
  const pkg = await readFile(join(p.path, 'package.json'), 'utf-8').catch(() => '')
  const scripts = pkg ? (JSON.parse(pkg).scripts ?? {}) as Record<string, string> : {}
  const dev = scripts.dev ?? scripts.start ?? scripts.serve ?? ''
  const m = dev.match(/(?:--port[= ]|-p\s+)(\d{2,5})/)
  if (m) return [Number(m[1]), 'package.json script']
  for (const f of ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']) {
    const cfg = await readFile(join(p.path, f), 'utf-8').catch(() => '')
    const vm = cfg.match(/server\s*:\s*\{[^}]*?port\s*:\s*(\d{2,5})/s)
    if (vm) return [Number(vm[1]), f]
  }
  return null
}

/** Command lines of the processes listening on dev ports (Windows: one CIM query) */
async function listeningCommandLines(): Promise<Map<number, string>> {
  const ports = (await getListeningPorts()).filter(p => p.pid && p.port >= 1024)
  const byPid = new Map<number, number[]>()
  for (const p of ports) byPid.set(p.pid!, [...(byPid.get(p.pid!) ?? []), p.port])
  const result = new Map<number, string>()
  if (byPid.size === 0) return result
  try {
    let rows: { pid: number; cmd: string }[] = []
    if (process.platform === 'win32') {
      const filter = [...byPid.keys()].map(pid => `ProcessId=${pid}`).join(' or ')
      const out = await run(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter '${filter}' | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"`, { timeout: 10_000 })
      const parsed = JSON.parse(out || '[]')
      rows = (Array.isArray(parsed) ? parsed : [parsed]).map((r: { ProcessId: number; CommandLine: string | null }) => ({ pid: r.ProcessId, cmd: r.CommandLine ?? '' }))
    } else {
      const out = await run(`ps -o pid=,args= -p ${[...byPid.keys()].join(',')}`)
      rows = out.split('\n').filter(Boolean).map(l => { const m = l.trim().match(/^(\d+)\s+(.*)$/); return { pid: Number(m?.[1]), cmd: m?.[2] ?? '' } })
    }
    for (const r of rows) for (const port of byPid.get(r.pid) ?? []) result.set(port, r.cmd.toLowerCase())
  } catch { /* best effort */ }
  return result
}

export async function suggestDomains(): Promise<DomainSuggestion[]> {
  const existing = listDomains()
  const [cmdlines, projects] = await Promise.all([listeningCommandLines(), Promise.resolve(loadProjects())])
  const out: DomainSuggestion[] = []
  const usedPorts = new Set(existing.map(d => d.port))

  // 1. Running dev servers whose command line points into a project folder
  const norm = (s: string) => s.toLowerCase().replace(/\\/g, '/')
  for (const [port, rawCmd] of cmdlines) {
    const cmd = norm(rawCmd)
    const p = projects
      .filter(x => cmd.includes(norm(x.path) + '/'))
      .sort((a, b) => b.path.length - a.path.length)[0] // deepest match wins
    // One suggestion per project (a project can run several dev servers)
    if (!p || usedPorts.has(port) || out.some(o => o.projectName === p.name)) continue
    usedPorts.add(port)
    out.push({ projectName: p.name, domain: `${slug(p.name)}.test`, port, source: 'running process', running: true })
  }

  // 2. Ports written in the project config
  await Promise.all(projects.map(async p => {
    if (out.some(o => o.projectName === p.name)) return
    const explicit = await explicitPort(p, await readEnvs(p))
    if (!explicit || usedPorts.has(explicit[0])) return
    usedPorts.add(explicit[0])
    out.push({ projectName: p.name, domain: `${slug(p.name)}.test`, port: explicit[0], source: explicit[1], running: cmdlines.has(explicit[0]) })
  }))

  return out
    .filter(o => !existing.some(d => d.domain === o.domain))
    .sort((a, b) => Number(b.running) - Number(a.running) || a.projectName.localeCompare(b.projectName))
}
