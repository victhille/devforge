// ─── Local domains (hosts + reverse proxy) ───────────────────────────────────

export interface LocalDomain {
  id: string
  /** e.g. shop.test */
  domain: string
  /** Local port the domain forwards to */
  port: number
  enabled: boolean
}

export interface DomainsStatus {
  /** Port the proxy listens on, null when stopped */
  proxyPort: number | null
  proxyError?: string
  /** Enabled domains missing from the hosts file (or stale ones present) */
  hostsInSync: boolean
  hostsPath: string
}

export interface DomainsAPI {
  list:   () => Promise<LocalDomain[]>
  save:   (d: LocalDomain) => Promise<void>
  remove: (id: string) => Promise<void>
  status: () => Promise<DomainsStatus>
  /** Rewrite the DevForge block of the hosts file (asks for admin rights) */
  applyHosts: () => Promise<{ ok: boolean; error?: string }>
}
