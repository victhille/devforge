import type { ConnectionKind, ConnectionTest, ConnectionsOverview } from '@shared/types'
import { runFile } from '../../lib/exec'
import { githubLogin } from '../projects/projectSetup'
import { githubToken, hasToken, saveToken as saveGithubToken } from '../github/githubService'
import { account as vercelAccount, checkAccount as vercelCheck, saveToken as saveVercelToken } from '../vercel/vercelService'
import { getApiKey, saveConfig as saveAssistantConfig } from '../assistant/assistantStorage'
import { loadSshConnections, removeSshConnection } from '../ssh/sshStorage'
import { connectSsh, sshRun } from '../ssh/sshClient'
import { getDbConnection, listDbConnections, removeDbConnection } from '../database/dbStorage'
import { testDb } from '../database/dbClient'

/**
 * Settings › Connections (v3.0 lot 1): every service DevForge can reach, in
 * one place. Reads whether each one is configured (never a secret), tests it
 * for real, and forgets it. Each service keeps its own storage.
 */

const gitConfig = async (key: string) => {
  const r = await runFile('git', ['config', '--global', '--get', key], { timeout: 10_000 })
  return r.ok ? r.stdout.trim() || null : null
}

async function dockerVersion(timeout = 15_000): Promise<string | null> {
  const r = await runFile('docker', ['version', '--format', '{{.Server.Version}}'], { timeout })
  return r.ok && /^\d/.test(r.stdout.trim()) ? r.stdout.trim() : null
}

/** GitHub CLI and Docker answer slowly (a stopped engine waits): the page reloads the overview after each change, so they are kept a minute */
const PROBE_TTL = 60_000
let probes: { at: number; value: Promise<[string | null, string | null]> } | null = null
function slowProbes(): Promise<[string | null, string | null]> {
  if (!probes || Date.now() - probes.at > PROBE_TTL) probes = { at: Date.now(), value: Promise.all([githubLogin(), dockerVersion(5_000)]) }
  return probes.value
}

/** Started with the app: Connections then opens without waiting */
export function warmProbes(): void {
  slowProbes().catch(() => {})
}

const where = (d: { type: string; host?: string; port?: number; database?: string; file?: string }) =>
  d.type === 'sqlite' ? d.file ?? '' : `${d.host ?? ''}${d.port ? `:${d.port}` : ''}${d.database ? `/${d.database}` : ''}`

export async function overview(): Promise<ConnectionsOverview> {
  const [[cli, docker], name, email] = await Promise.all([slowProbes(), gitConfig('user.name'), gitConfig('user.email')])
  return {
    github: { cli, token: hasToken() },
    git: { name, email },
    forgy: { hasKey: !!getApiKey() },
    vercel: vercelAccount(),
    docker: { version: docker },
    servers: loadSshConnections().map(s => ({ id: s.id, name: s.name, host: s.host, username: s.username })),
    databases: listDbConnections().map(d => ({ id: d.id, name: d.name, type: d.type, target: where(d) }))
  }
}

const failed = (err: unknown): ConnectionTest => ({ ok: false, detail: String(err instanceof Error ? err.message : err).slice(0, 300) })

export async function test(kind: ConnectionKind, id?: string): Promise<ConnectionTest> {
  try {
    switch (kind) {
      case 'github': {
        const tok = await githubToken()
        if (!tok) return { ok: false, detail: 'NO_TOKEN' }
        const res = await fetch('https://api.github.com/user', { headers: { authorization: `Bearer ${tok}`, 'user-agent': 'DevForge' }, signal: AbortSignal.timeout(15_000) })
        if (!res.ok) return { ok: false, detail: `GitHub ${res.status}` }
        return { ok: true, detail: ((await res.json()) as { login: string }).login }
      }
      case 'forgy': {
        const key = getApiKey()
        if (!key) return { ok: false, detail: 'NO_KEY' }
        // Lists the models: no message sent, nothing billed
        const res = await fetch('https://api.anthropic.com/v1/models?limit=1', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(15_000) })
        return res.ok ? { ok: true, detail: 'Anthropic' } : { ok: false, detail: res.status === 401 ? 'BAD_KEY' : `Anthropic ${res.status}` }
      }
      case 'vercel': return { ok: true, detail: await vercelCheck() }
      case 'docker': {
        const v = await dockerVersion()
        return v ? { ok: true, detail: `Docker ${v}` } : { ok: false, detail: 'DOCKER_DOWN' }
      }
      case 'server': {
        const client = await connectSsh(String(id ?? ''))
        try {
          const r = await sshRun(client, 'uname -sr', 15_000)
          return { ok: r.code === 0, detail: r.output.trim().split('\n')[0] ?? '' }
        } finally { client.end() }
      }
      case 'database': {
        const c = getDbConnection(String(id ?? ''))
        if (!c) return { ok: false, detail: 'NOT_FOUND' }
        return { ok: true, detail: await testDb(c) }
      }
    }
  } catch (err) { return failed(err) }
}

export async function disconnect(kind: Exclude<ConnectionKind, 'docker'>, id?: string): Promise<void> {
  switch (kind) {
    case 'github': await saveGithubToken(null); return
    case 'forgy': saveAssistantConfig({ clearKey: true }); return
    case 'vercel': await saveVercelToken(null); return
    case 'server': removeSshConnection(String(id ?? '')); return
    case 'database': removeDbConnection(String(id ?? '')); return
  }
}

/** Git's global name and e-mail (one line each, as git takes them) */
export async function setGitIdentity(name: string, email: string): Promise<void> {
  const n = String(name ?? '').trim(), e = String(email ?? '').trim()
  if (!n || n.length > 100 || /[\r\n]/.test(n)) throw new Error('BAD_NAME')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) throw new Error('BAD_EMAIL')
  for (const [k, v] of [['user.name', n], ['user.email', e]]) {
    const r = await runFile('git', ['config', '--global', k, v], { timeout: 10_000 })
    if (!r.ok) throw new Error(r.stderr.trim() || 'GIT_FAILED')
  }
}
