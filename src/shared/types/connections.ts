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
  forgy: { hasKey: boolean }
  vercel: VercelAccount
  /** Docker on this PC: the engine's version, null when it does not answer */
  docker: { version: string | null }
  servers: { id: string; name: string; host: string; username: string }[]
  databases: { id: string; name: string; type: string; target: string }[]
}

export type ConnectionKind = 'github' | 'forgy' | 'vercel' | 'docker' | 'server' | 'database'

/** A test's answer: what was reached ("victhille", "Ubuntu 24.04", "PostgreSQL 16.4") or why not */
export interface ConnectionTest { ok: boolean; detail: string }

export interface ConnectionsAPI {
  overview: () => Promise<ConnectionsOverview>
  /** `id` for a server or a database */
  test: (kind: ConnectionKind, id?: string) => Promise<ConnectionTest>
  /** Forgets the saved token or key, the server or the database (GitHub CLI's login stays: `gh auth logout`) */
  disconnect: (kind: Exclude<ConnectionKind, 'docker'>, id?: string) => Promise<void>
  setGitIdentity: (name: string, email: string) => Promise<void>
}
