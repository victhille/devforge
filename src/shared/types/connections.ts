// ─── Settings › Connections (v3.0 lot 1) ───────────────────────────────────────

import type { VercelAccount } from './vercel'

/** Everything DevForge can reach, configured or not; never a secret, only whether it is there */
export interface ConnectionsOverview {
  github: {
    /** GitHub CLI's account (`gh auth login`), null when gh is missing or logged out */
    cli: string | null
    /** A token saved in DevForge (encrypted) */
    token: boolean
  }
  /** Git's global identity, used by the commits */
  git: { name: string | null; email: string | null }
  forgy: { hasKey: boolean; source: 'saved' | 'env' | null }
  vercel: VercelAccount
  /** Docker on this PC: the engine's version, null when it does not answer */
  docker: { version: string | null }
  servers: { id: string; name: string; host: string; username: string }[]
  databases: { id: string; name: string; type: string; target: string }[]
  /** n8n installed from DevForge, one per server; `where` is its domain, or "local" */
  n8n: { connectionId: string; server: string; where: string; hasKey: boolean }[]
  /** Status pages installed from DevForge: their alerts live on the server, read on demand */
  statusPages: { connectionId: string; server: string; where: string }[]
}

/** A status page's alert channels: set or not, never the ntfy topic (it works like a password) */
export interface StatusAlertsState { ntfy: boolean; webhook: boolean }

export type ConnectionKind = 'github' | 'forgy' | 'vercel' | 'docker' | 'server' | 'database' | 'n8n' | 'alerts'

/** A test's answer: what was reached ("octocat", "Ubuntu 24.04", "PostgreSQL 16.4") or why not */
export interface ConnectionTest { ok: boolean; detail: string }

export interface ConnectionsAPI {
  overview: () => Promise<ConnectionsOverview>
  /** `id` for a server or a database, the server of an n8n or a status page */
  test: (kind: ConnectionKind, id?: string) => Promise<ConnectionTest>
  /** Forgets the saved token or key, the server or the database, n8n's API key, the status page's ntfy alerts (GitHub CLI's login stays: `gh auth logout`) */
  disconnect: (kind: Exclude<ConnectionKind, 'docker'>, id?: string) => Promise<void>
  setGitIdentity: (name: string, email: string) => Promise<void>
  /** Reads a status page's alerts on its server */
  alerts: (connectionId: string) => Promise<StatusAlertsState>
  /** Sets a status page's ntfy alerts (server, topic), its other settings kept */
  setNtfy: (connectionId: string, server: string, topic: string) => Promise<void>
}
