import { readFile } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type { DbConnection, DetectedDatabase } from '@shared/types'
import { connectSsh, shQuote, sshRun } from '../ssh/sshClient'
import { getSshConnectionWithSecret, sshServerFor } from '../ssh/sshStorage'
import { loadProjects } from '../projects/projectStorage'
import { parseEnv } from '../envfiles/envFiles'
import { listDbConnections, saveDbConnection } from './dbStorage'

type Found = Omit<DetectedDatabase, 'key' | 'exists' | 'hasPassword'> & { password?: string; sshConnectionId?: string }

/** Full candidates (with passwords) stay here; the renderer only gets keys */
const cache = new Map<string, Found>()

const COLORS = ['#3DD68C', '#4F8EF7', '#F5A623', '#A78BFA', '#34D399', '#60A5FA']

function publish(found: Found[]): DetectedDatabase[] {
  const saved = listDbConnections()
  return found.map(f => {
    const key = randomUUID()
    cache.set(key, f)
    const exists = saved.some(s =>
      s.type === f.type && (s.host ?? '') === f.host && (s.port ?? 0) === f.port &&
      (s.database ?? '') === (f.database ?? '') && (s.sshConnectionId ?? '') === (f.sshConnectionId ?? ''))
    const { password, sshConnectionId: _s, ...rest } = f
    return { ...rest, key, hasPassword: !!password, exists }
  })
}

export function addDetected(key: string): string {
  const f = cache.get(key)
  if (!f) throw new Error('Detection expired, run it again')
  const id = randomUUID()
  const conn: DbConnection = {
    id, name: f.name, type: f.type, host: f.host, port: f.port, user: f.user, database: f.database,
    password: f.password, sshConnectionId: f.sshConnectionId,
    color: COLORS[listDbConnections().length % COLORS.length]
  }
  saveDbConnection(conn)
  return id
}

// ─── On a server, through SSH ─────────────────────────────────────────────────

/**
 * One SSH command: inspect running DB containers (docker, or sudo -n docker
 * when the user is not in the docker group) and list listening ports.
 */
const REMOTE_SCRIPT = `
D=docker; $D ps >/dev/null 2>&1 || D="sudo -n docker"
for id in $($D ps -q 2>/dev/null); do
  echo "C|$($D inspect --format '{{.Name}}|{{.Config.Image}}|{{json .Config.Env}}|{{json .NetworkSettings.Ports}}|{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' $id 2>/dev/null)"
done
(ss -tlnH 2>/dev/null || netstat -tln 2>/dev/null) | awk '{for(i=1;i<=NF;i++) if ($i ~ /:(5432|3306)$/) print "L|" $i}'
`

type Ports = Record<string, { HostIp: string; HostPort: string }[] | null>

function envMap(list: string[]): Record<string, string> {
  return Object.fromEntries(list.map(e => { const i = e.indexOf('='); return [e.slice(0, i), e.slice(i + 1)] }))
}

export { REMOTE_SCRIPT }

export async function detectRemote(sshConnectionId: string): Promise<DetectedDatabase[]> {
  const server = getSshConnectionWithSecret(sshConnectionId)
  if (!server) throw new Error('SSH connection not found')
  const client = await connectSsh(sshConnectionId)
  let output: string
  try {
    output = (await sshRun(client, `bash -c ${shQuote(REMOTE_SCRIPT)}`)).output
  } finally {
    client.end()
  }

  return publish(parseRemoteOutput(output, server.name, sshConnectionId))
}

/**
 * The database a connection means, as actually running on the server: same
 * type, and the same database name or published port. Used when the saved
 * host/port does not answer from the server (e.g. a port only known inside
 * Docker's network, or a project .env written for docker compose).
 */
export async function findOnServer(sshConnectionId: string, c: DbConnection): Promise<Found | undefined> {
  const server = getSshConnectionWithSecret(sshConnectionId)
  if (!server) return undefined
  const client = await connectSsh(sshConnectionId)
  let output: string
  try {
    output = (await sshRun(client, `bash -c ${shQuote(REMOTE_SCRIPT)}`)).output
  } finally {
    client.end()
  }
  return pickMatch(parseRemoteOutput(output, server.name, sshConnectionId), c)
}

/** Best candidate for a saved connection (exported for tests) */
export function pickMatch(found: Found[], c: DbConnection): Found | undefined {
  const same = found.filter(f => f.type === c.type)
  return same.find(f => c.database && f.database === c.database)
    ?? same.find(f => f.port === c.port)
    ?? (same.length === 1 ? same[0] : undefined)
}

/** Turn the remote script output into candidates (exported for tests) */
export function parseRemoteOutput(output: string, serverName: string, sshConnectionId: string): Found[] {
  const found: Found[] = []
  const publishedPorts = new Set<number>()

  for (const line of output.split('\n')) {
    if (!line.startsWith('C|')) continue
    const [, rawName, image, envJson, portsJson, ips] = line.split('|')
    const img = (image ?? '').toLowerCase()
    const type = /postgres|postgis|timescale|supabase\/postgres/.test(img) ? 'postgres' : /mysql|mariadb|percona/.test(img) ? 'mysql' : null
    if (!type) continue
    let env: Record<string, string> = {}
    let ports: Ports = {}
    try { env = envMap(JSON.parse(envJson)) } catch { /* no env */ }
    try { ports = JSON.parse(portsJson) ?? {} } catch { /* no ports */ }

    const inner = type === 'postgres' ? 5432 : 3306
    const binding = (ports[`${inner}/tcp`] ?? [])[0]
    let host: string, port: number
    if (binding?.HostPort) {
      host = '127.0.0.1'
      port = Number(binding.HostPort)
      publishedPorts.add(port)
    } else {
      // Not published: reach the container directly on its Docker network IP
      host = (ips ?? '').trim().split(/\s+/)[0] || '127.0.0.1'
      port = inner
    }

    let user: string | undefined, password: string | undefined, database: string | undefined
    if (type === 'postgres') {
      user = env.POSTGRES_USER || 'postgres'
      password = env.POSTGRES_PASSWORD
      database = env.POSTGRES_DB || user
    } else if (env.MYSQL_USER || env.MARIADB_USER) {
      user = env.MYSQL_USER || env.MARIADB_USER
      password = env.MYSQL_PASSWORD || env.MARIADB_PASSWORD
      database = env.MYSQL_DATABASE || env.MARIADB_DATABASE
    } else {
      user = 'root'
      password = env.MYSQL_ROOT_PASSWORD || env.MARIADB_ROOT_PASSWORD
      database = env.MYSQL_DATABASE || env.MARIADB_DATABASE
    }

    const container = rawName.replace(/^\//, '')
    found.push({
      name: `${database ?? container} @ ${serverName}`, type, host, port, user, password, database,
      source: 'docker', origin: container, sshConnectionId
    })
  }

  // Native services (not a published Docker port)
  for (const line of output.split('\n')) {
    if (!line.startsWith('L|')) continue
    const addr = line.slice(2)
    const port = Number(addr.split(':').pop())
    if (publishedPorts.has(port) || found.some(f => f.source === 'native' && f.port === port)) continue
    const type = port === 5432 ? 'postgres' : 'mysql'
    found.push({
      name: `${type === 'postgres' ? 'PostgreSQL' : 'MySQL'} @ ${serverName}`, type, host: '127.0.0.1', port,
      user: type === 'postgres' ? 'postgres' : 'root', source: 'native', origin: addr, sshConnectionId
    })
  }

  return found
}

// ─── In local projects' .env files ────────────────────────────────────────────

/** Compose service names (db, mysql…) are reachable on localhost when published */
const localHost = (h: string) => (!h || /^(localhost|127\.0\.0\.1|::1)$/.test(h) || !/[.:]/.test(h) ? '127.0.0.1' : h)

function fromUrl(url: string): Omit<Found, 'name' | 'source' | 'origin'> | null {
  const m = url.match(/^(postgres(?:ql)?|pgsql|mysql|mariadb|mysql2):\/\/(?:([^:@/]*)(?::([^@/]*))?@)?([^:/?]+)?(?::(\d+))?\/([^?]+)?/i)
  if (!m) return null
  const type = /^(postgres|pgsql)/i.test(m[1]) ? 'postgres' : 'mysql'
  return {
    type,
    user: m[2] ? decodeURIComponent(m[2]) : undefined,
    password: m[3] ? decodeURIComponent(m[3]) : undefined,
    host: localHost(m[4] ?? ''),
    port: m[5] ? Number(m[5]) : type === 'postgres' ? 5432 : 3306,
    database: m[6] ? decodeURIComponent(m[6]) : undefined
  }
}

function fromEnv(env: Record<string, string>): Omit<Found, 'name' | 'source' | 'origin'> | null {
  for (const k of ['DATABASE_URL', 'DB_URL', 'POSTGRES_URL', 'MYSQL_URL']) {
    if (env[k]) { const r = fromUrl(env[k]); if (r) return r }
  }
  // Laravel style
  if (env.DB_CONNECTION && /mysql|mariadb|pgsql|postgres/i.test(env.DB_CONNECTION)) {
    const type = /pg|postgres/i.test(env.DB_CONNECTION) ? 'postgres' : 'mysql'
    return {
      type, host: localHost(env.DB_HOST ?? ''), port: Number(env.DB_PORT) || (type === 'postgres' ? 5432 : 3306),
      user: env.DB_USERNAME || env.DB_USER, password: env.DB_PASSWORD, database: env.DB_DATABASE || env.DB_NAME
    }
  }
  // Docker-compose style variables
  if (env.POSTGRES_PASSWORD || env.POSTGRES_DB) {
    return { type: 'postgres', host: localHost(env.POSTGRES_HOST ?? ''), port: Number(env.POSTGRES_PORT) || 5432,
      user: env.POSTGRES_USER || 'postgres', password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB || env.POSTGRES_USER || 'postgres' }
  }
  if (env.MYSQL_DATABASE || env.MYSQL_ROOT_PASSWORD) {
    return { type: 'mysql', host: localHost(env.MYSQL_HOST ?? ''), port: Number(env.MYSQL_PORT) || 3306,
      user: env.MYSQL_USER || 'root', password: env.MYSQL_PASSWORD || env.MYSQL_ROOT_PASSWORD, database: env.MYSQL_DATABASE }
  }
  return null
}

export async function detectLocal(): Promise<DetectedDatabase[]> {
  const found: Found[] = []
  await Promise.all(loadProjects().map(async p => {
    // .env.local overrides .env, like most frameworks
    const merged: Record<string, string> = {}
    let origin = ''
    for (const name of ['.env', '.env.local', 'backend/.env', 'api/.env']) {
      const content = await readFile(join(p.path, name), 'utf-8').catch(() => null)
      if (content === null) continue
      Object.assign(merged, parseEnv(content))
      origin = `${p.name}/${name}`
    }
    const r = origin ? fromEnv(merged) : null
    if (!r) return
    // Points at one of our SSH servers: connect through it
    const server = sshServerFor(r.host)
    found.push({
      ...r, ...(server && { host: '127.0.0.1', sshConnectionId: server.id }),
      name: `${r.database ?? p.name} (${p.name})`, source: 'env', origin
    })
  }))
  // Same database used by several projects: keep one entry
  const unique = new Map<string, Found>()
  for (const f of found) {
    const k = `${f.type}|${f.host}|${f.port}|${f.database}|${f.user}`
    const prev = unique.get(k)
    unique.set(k, prev ? { ...prev, origin: `${prev.origin}, ${f.origin}` } : f)
  }
  return publish([...unique.values()].sort((a, b) => a.name.localeCompare(b.name)))
}
