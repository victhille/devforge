import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { request } from 'http'
import { createServer, isIP, type AddressInfo, type Server } from 'net'
import { lookup, resolve4 } from 'dns/promises'
import { app, safeStorage } from 'electron'
import type { N8nDomainCheck, N8nExecution, N8nExposure, N8nInstance, N8nPrecheck, N8nStatus, N8nWorkflow } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { log } from '../../lib/log'
import { sshService } from '../ssh/sshService'
import { shQuote } from '../ssh/sshClient'
import { runOn, sessionFor } from '../monitor/vpsWatch'
import { loadProjects } from '../projects/projectStorage'
import { loadSshConnections } from '../ssh/sshStorage'

/**
 * n8n on a VPS, installed and followed from DevForge. Everything lives in
 * ~/devforge/n8n on the server (compose file, Caddyfile, .env, backups), so
 * nothing else on the server is touched. The secrets of the .env are made on
 * the server and never leave it. The REST API is reached on 127.0.0.1:5678
 * through the SSH session: n8n's port is never opened to the internet.
 */

const DIR = '~/devforge/n8n'
const PORT = 5678
const SEP = '@@DF@@'
const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
const EMAIL_RE = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/
const ID_RE = /^[\w-]{1,64}$/

interface Stored { connectionId: string; domain: string; exposure: N8nExposure; installedAt: string; keyEnc?: string }

const storePath = () => join(app.getPath('userData'), 'n8n.json')
function readStore(): Stored[] {
  try { return (JSON.parse(readFileSync(storePath(), 'utf-8')) as { instances?: Stored[] }).instances ?? [] } catch { return [] }
}
const writeStore = (instances: Stored[]) => writeJsonFile(storePath(), { instances })
const publicOf = (s: Stored): N8nInstance => ({ connectionId: s.connectionId, domain: s.domain, exposure: s.exposure, installedAt: s.installedAt, hasKey: !!s.keyEnc })

export const listInstances = (): N8nInstance[] => readStore().map(publicOf)

function instance(connectionId: string): Stored {
  const s = readStore().find(i => i.connectionId === connectionId)
  if (!s) throw new Error('n8n is not installed on this server from DevForge')
  return s
}

export function saveApiKey(connectionId: string, apiKey: string | null): N8nInstance {
  const all = readStore()
  const s = all.find(i => i.connectionId === connectionId)
  if (!s) throw new Error('Unknown n8n server')
  if (apiKey?.trim()) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
    s.keyEnc = safeStorage.encryptString(apiKey.trim()).toString('base64')
  } else delete s.keyEnc
  writeStore(all)
  return publicOf(s)
}

export function forgetInstance(connectionId: string): void {
  closeTunnel(connectionId)
  writeStore(readStore().filter(i => i.connectionId !== connectionId))
}

// ─── Install ──────────────────────────────────────────────────────────────────

/** The compose file: Postgres, n8n on 127.0.0.1 only, Caddy for HTTPS when asked */
export function composeFile(domain: string, exposure: N8nExposure): string {
  const https = exposure === 'caddy'
  const host = https ? domain : 'localhost'
  return `# Written by DevForge. Secrets are in .env (made on this server).
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: \${POSTGRES_PASSWORD}
      POSTGRES_DB: n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n -d n8n"]
      interval: 10s
      timeout: 5s
      retries: 10

  n8n:
    image: docker.n8n.io/n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "127.0.0.1:${PORT}:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: n8n
      DB_POSTGRESDB_PASSWORD: \${POSTGRES_PASSWORD}
      N8N_ENCRYPTION_KEY: \${N8N_ENCRYPTION_KEY}
      N8N_HOST: ${host}
      N8N_PROTOCOL: ${https ? 'https' : 'http'}
      WEBHOOK_URL: ${https ? `https://${domain}/` : `http://localhost:${PORT}/`}
      N8N_SECURE_COOKIE: "${https}"
      N8N_RUNNERS_ENABLED: "true"
      GENERIC_TIMEZONE: Europe/Paris
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      postgres:
        condition: service_healthy
${https ? `
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - n8n
` : ''}
volumes:
  postgres_data:
  n8n_data:${https ? '\n  caddy_data:\n  caddy_config:' : ''}
`
}

export const caddyFile = (domain: string, email: string) => `{
	email ${email}
}

${domain} {
	reverse_proxy n8n:5678
}
`

/** Shell script run on the server: writes the files, makes the .env once, starts the stack */
export function installScript(domain: string, exposure: N8nExposure, email: string): string {
  const b64 = (s: string) => Buffer.from(s, 'utf-8').toString('base64')
  return [
    'set -e',
    `mkdir -p ${DIR}/backups && cd ${DIR}`,
    `echo ${b64(composeFile(domain, exposure))} | base64 -d > docker-compose.yml`,
    exposure === 'caddy' ? `echo ${b64(caddyFile(domain, email))} | base64 -d > Caddyfile` : 'rm -f Caddyfile',
    // Made here once: the secrets never travel and a re-install keeps the data readable
    "if [ ! -f .env ]; then umask 077; R() { head -c \"$1\" /dev/urandom | od -An -tx1 | tr -d ' \\n'; }; printf 'POSTGRES_PASSWORD=%s\\nN8N_ENCRYPTION_KEY=%s\\n' \"$(R 24)\" \"$(R 32)\" > .env; fi",
    'docker compose pull',
    // --remove-orphans: going back to "local" removes the Caddy of an earlier HTTPS install
    'docker compose up -d --remove-orphans',
    'docker compose ps'
  ].join('\n')
}

export function validateInstall(opts: { domain: string; exposure: N8nExposure; email: string }): { domain: string; exposure: N8nExposure; email: string } {
  const exposure: N8nExposure = opts.exposure === 'caddy' ? 'caddy' : 'local'
  const domain = (opts.domain ?? '').trim().toLowerCase()
  const email = (opts.email ?? '').trim()
  if (exposure === 'caddy') {
    if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain')
    if (!EMAIL_RE.test(email)) throw new Error('Invalid email')
  }
  return { domain: exposure === 'caddy' ? domain : '', exposure, email }
}

export async function precheck(connectionId: string): Promise<N8nPrecheck> {
  const out = await runOn(connectionId, [
    'docker --version 2>/dev/null || true',
    'docker compose version >/dev/null 2>&1 && echo yes || true',
    "(ss -ltnH 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}'",
    `[ -d ${DIR} ] && echo yes || true`
  ].join(`; echo '${SEP}'; `))
  const [docker = '', compose = '', ports = '', existing = ''] = out.split(SEP).map(s => s.trim())
  const busy = new Set<number>()
  for (const line of ports.split('\n')) {
    const m = /:(\d+)$/.exec(line.trim())
    if (m && (m[1] === '80' || m[1] === '443')) busy.add(Number(m[1]))
  }
  return { docker: docker || null, compose: compose === 'yes', busyPorts: [...busy].sort((a, b) => a - b), existing: existing === 'yes' }
}

/** Runs a script on the server, streaming its output; true when it exits with 0 */
async function stream(connectionId: string, script: string, onLog: (text: string) => void): Promise<boolean> {
  const sid = await sessionFor(connectionId)
  // The exit code comes last as "@@DF@@<code>"; keep everything else for the log
  let all = ''
  const code = await sshService.execStream(sid, `bash -lc ${shQuote(script)} 2>&1; echo "${SEP}$?"`, text => {
    all += text
    const clean = text.replace(new RegExp(`${SEP}\\d*\\s*$`), '')
    if (clean) onLog(clean)
  }, 20 * 60_000)
  const m = new RegExp(`${SEP}(\\d+)\\s*$`).exec(all)
  return (m ? Number(m[1]) : code) === 0
}

export async function install(connectionId: string, raw: { domain: string; exposure: N8nExposure; email: string }, onLog: (text: string) => void): Promise<{ ok: boolean }> {
  const opts = validateInstall(raw)
  if (opts.exposure === 'caddy') {
    const check = await checkDomain(connectionId, opts.domain)
    if (!check.ok) throw new Error(check.domainIps.length ? `DOMAIN_ELSEWHERE:${check.domainIps.join(', ')}` : 'DOMAIN_UNKNOWN')
  }
  log('info', 'n8n', `Install on ${connectionId} (${opts.exposure}${opts.domain ? ` ${opts.domain}` : ''})`)
  const ok = await stream(connectionId, installScript(opts.domain, opts.exposure, opts.email), onLog)
  if (ok) {
    const all = readStore().filter(i => i.connectionId !== connectionId)
    const keyEnc = readStore().find(i => i.connectionId === connectionId)?.keyEnc
    all.push({ connectionId, domain: opts.domain, exposure: opts.exposure, installedAt: new Date().toISOString(), ...(keyEnc ? { keyEnc } : {}) })
    writeStore(all)
  }
  return { ok }
}

/** Name → IPv4 addresses (injectable for tests) */
type Resolver = (name: string) => Promise<string[]>
const publicDns: Resolver = name => resolve4(name)
const systemDns: Resolver = async name => (isIP(name) ? [name] : (await lookup(name, { all: true, family: 4 })).map(a => a.address))

/**
 * Before an HTTPS install: the sub-domain must point to the server, or Caddy
 * cannot get a certificate and the site is unreachable.
 */
export async function checkDomain(connectionId: string, domain: string, dns: { domain: Resolver; server: Resolver } = { domain: publicDns, server: systemDns }): Promise<N8nDomainCheck> {
  const conn = loadSshConnections().find(c => c.id === connectionId)
  if (!conn) throw new Error('Unknown server')
  const [domainIps, serverIps] = await Promise.all([dns.domain(domain).catch(() => [] as string[]), dns.server(conn.host).catch(() => [] as string[])])
  return { ok: domainIps.length > 0 && domainIps.some(ip => serverIps.includes(ip)), domainIps, serverIps }
}

// ─── Local tunnel ─────────────────────────────────────────────────────────────

/** 127.0.0.1:<port> on this PC → n8n on the server, through DevForge's SSH session */
const tunnels = new Map<string, Server>()

export async function openTunnel(connectionId: string): Promise<string> {
  const known = tunnels.get(connectionId)
  if (known?.listening) return `http://localhost:${(known.address() as AddressInfo).port}`
  await sessionFor(connectionId)
  const server = createServer(sock => {
    sock.pause()
    sessionFor(connectionId)
      .then(sid => sshService.forwardOut(sid, PORT))
      .then(remote => { sock.pipe(remote).pipe(sock); remote.on('error', () => sock.destroy()); sock.on('error', () => remote.destroy()); sock.resume() })
      .catch(err => { log('warn', 'n8n', `Tunnel: ${err instanceof Error ? err.message : err}`); sock.destroy() })
  })
  // n8n's own port when free (its links then match), any port otherwise
  const listen = (port: number) => new Promise<void>((ok, ko) => { server.once('error', ko); server.listen(port, '127.0.0.1', () => { server.off('error', ko); ok() }) })
  await listen(PORT).catch(() => listen(0))
  tunnels.set(connectionId, server)
  const url = `http://localhost:${(server.address() as AddressInfo).port}`
  log('info', 'n8n', `Tunnel ${url} → ${connectionId}`)
  return url
}

export function closeTunnel(connectionId: string): void {
  tunnels.get(connectionId)?.close()
  tunnels.delete(connectionId)
}

export function closeTunnels(): void {
  for (const id of [...tunnels.keys()]) closeTunnel(id)
}

// ─── Follow ───────────────────────────────────────────────────────────────────

export async function status(connectionId: string): Promise<N8nStatus> {
  const s = readStore().find(i => i.connectionId === connectionId)
  const out = await runOn(connectionId, [
    `[ -f ${DIR}/docker-compose.yml ] && echo yes || true`,
    `cd ${DIR} 2>/dev/null && docker compose ps -a --format '{{.Service}}|{{.State}}|{{.Status}}' 2>/dev/null || true`,
    `cd ${DIR} 2>/dev/null && docker compose exec -T n8n n8n --version 2>/dev/null || true`
  ].join(`; echo '${SEP}'; `), 30_000)
  const [installed = '', ps = '', version = ''] = out.split(SEP).map(x => x.trim())
  const containers = ps.split('\n').filter(Boolean).map(l => { const [name = '', state = '', st = ''] = l.split('|'); return { name, state, status: st } })
  return {
    installed: installed === 'yes',
    state: containers.find(c => c.name === 'n8n')?.state ?? null,
    version: /^\d+\.\d+/.test(version) ? version.split('\n').pop()!.trim() : null,
    containers,
    url: s?.exposure === 'caddy' && s.domain ? `https://${s.domain}` : null
  }
}

export async function logs(connectionId: string, lines: number): Promise<string> {
  const n = Math.min(1000, Math.max(10, Math.round(lines) || 200))
  return runOn(connectionId, `cd ${DIR} && docker compose logs --tail ${n} --timestamps n8n 2>&1`, 30_000)
}

export async function control(connectionId: string, action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; output: string }> {
  if (!['start', 'stop', 'restart'].includes(action)) throw new Error('Invalid action')
  const out = await runOn(connectionId, `cd ${DIR} && docker compose ${action} 2>&1; echo "${SEP}$?"`, 180_000)
  const [output = '', code = '1'] = out.split(SEP)
  return { ok: code.trim() === '0', output: output.trim() }
}

/** Dump of the database first (last 5 kept), then the newest n8n image */
export const updateScript = () => [
  'set -e',
  `cd ${DIR} && mkdir -p backups`,
  'f="backups/n8n-$(date +%Y%m%d-%H%M%S).sql.gz"',
  'docker compose exec -T postgres pg_dump -U n8n n8n | gzip > "$f"',
  'echo "Backup: $f ($(du -h "$f" | cut -f1))"',
  'ls -1t backups/*.sql.gz | tail -n +6 | xargs -r rm --',
  'docker compose pull n8n',
  'docker compose up -d n8n'
].join('\n')

export async function update(connectionId: string, onLog: (text: string) => void): Promise<{ ok: boolean }> {
  log('info', 'n8n', `Update on ${connectionId}`)
  return { ok: await stream(connectionId, updateScript(), onLog) }
}

// ─── REST API (through the SSH session) ───────────────────────────────────────

function apiKey(connectionId: string): string {
  const enc = instance(connectionId).keyEnc
  if (!enc) throw new Error('NO_KEY')
  return safeStorage.decryptString(Buffer.from(enc, 'base64'))
}

async function api<T>(connectionId: string, method: 'GET' | 'POST', path: string): Promise<T> {
  const key = apiKey(connectionId)
  const sock = await sshService.forwardOut(await sessionFor(connectionId), PORT)
  return new Promise<T>((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port: PORT, method, path: `/api/v1${path}`,
      headers: { 'X-N8N-API-KEY': key, accept: 'application/json' },
      createConnection: () => sock as unknown as import('net').Socket
    }, res => {
      let body = ''
      res.setEncoding('utf-8')
      res.on('data', c => { body += c })
      res.on('end', () => {
        sock.destroy()
        if ((res.statusCode ?? 500) >= 400) {
          let msg = body
          try { msg = (JSON.parse(body) as { message?: string }).message ?? body } catch { /* text */ }
          reject(new Error(res.statusCode === 401 ? 'BAD_KEY' : `n8n ${res.statusCode}: ${msg.slice(0, 200)}`))
          return
        }
        try { resolve(JSON.parse(body || '{}') as T) } catch { reject(new Error('n8n answered something that is not JSON')) }
      })
    })
    req.setTimeout(20_000, () => req.destroy(new Error('n8n did not answer')))
    req.on('error', err => { sock.destroy(); reject(err) })
    req.end()
  })
}

interface RawWorkflow { id: string; name: string; active: boolean; updatedAt: string; tags?: { name: string }[] }
const toWorkflow = (w: RawWorkflow): N8nWorkflow => ({ id: String(w.id), name: w.name, active: !!w.active, updatedAt: w.updatedAt, tags: (w.tags ?? []).map(t => t.name) })

export async function workflows(connectionId: string): Promise<N8nWorkflow[]> {
  const out: N8nWorkflow[] = []
  let cursor = ''
  // Paged by 250; 4 pages are plenty for one server
  for (let i = 0; i < 4; i++) {
    const r = await api<{ data: RawWorkflow[]; nextCursor?: string | null }>(connectionId, 'GET', `/workflows?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)
    out.push(...r.data.map(toWorkflow))
    if (!r.nextCursor) break
    cursor = r.nextCursor
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export async function executions(connectionId: string, onlyErrors: boolean): Promise<N8nExecution[]> {
  const [r, wf] = await Promise.all([
    api<{ data: { id: string; workflowId: string; status?: string; finished?: boolean; startedAt: string; stoppedAt?: string | null; mode: string }[] }>(
      connectionId, 'GET', `/executions?limit=50&includeData=false${onlyErrors ? '&status=error' : ''}`),
    workflows(connectionId).catch(() => [] as N8nWorkflow[])
  ])
  const names = new Map(wf.map(w => [w.id, w.name]))
  return r.data.map(e => ({
    id: String(e.id), workflowId: String(e.workflowId), workflowName: names.get(String(e.workflowId)) ?? String(e.workflowId),
    status: e.status ?? (e.finished ? 'success' : 'error'), startedAt: e.startedAt, stoppedAt: e.stoppedAt ?? null, mode: e.mode
  }))
}

export async function setActive(connectionId: string, workflowId: string, active: boolean): Promise<N8nWorkflow> {
  if (!ID_RE.test(workflowId)) throw new Error('Invalid workflow')
  return toWorkflow(await api<RawWorkflow>(connectionId, 'POST', `/workflows/${workflowId}/${active ? 'activate' : 'deactivate'}`))
}

export async function retryExecution(connectionId: string, executionId: string): Promise<string> {
  if (!ID_RE.test(executionId)) throw new Error('Invalid execution')
  const r = await api<{ id?: string; status?: string }>(connectionId, 'POST', `/executions/${executionId}/retry`)
  return `Retried as execution ${r.id ?? '?'} (${r.status ?? 'started'})`
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workflow'

/** n8n/<name>.json in the project, pretty-printed for readable diffs */
export async function exportWorkflow(connectionId: string, workflowId: string, projectId: string): Promise<string> {
  if (!ID_RE.test(workflowId)) throw new Error('Invalid workflow')
  const project = loadProjects().find(p => p.id === projectId)
  if (!project) throw new Error('Unknown project')
  const wf = await api<RawWorkflow & Record<string, unknown>>(connectionId, 'GET', `/workflows/${workflowId}`)
  const dir = join(project.path, 'n8n')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `${slug(wf.name)}.json`)
  writeFileSync(file, JSON.stringify(wf, null, 2) + '\n', 'utf-8')
  return file
}
