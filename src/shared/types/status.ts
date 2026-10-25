// ─── Status page and 24/7 watch (v2.2 lot 4) ──────────────────────────────────

/**
 * How the page reaches the internet:
 * - caddy: its own Caddy on 80/443 (they are free);
 * - n8n: a site added to the Caddy of DevForge's n8n (it holds 80/443);
 * - port: plain http on port 3901 (another proxy holds 80/443).
 */
export type StatusExposure = 'caddy' | 'n8n' | 'port'

export interface StatusMonitor {
  id: string
  name: string
  type: 'http' | 'tcp'
  /** https://… for http, host:port for tcp */
  target: string
  public: boolean
  /** Goes down at the first failure (the "test an outage" button) */
  test?: boolean
}

export interface StatusAlerts {
  ntfy: { server: string; topic: string } | null
  webhook: string | null
}

export interface StatusConfig {
  title: string
  intervalSec: number
  failuresBeforeDown: number
  monitors: StatusMonitor[]
  alerts: StatusAlerts
}

export interface StatusMonitorState {
  status: 'up' | 'down' | 'unknown'
  since: string
  fails: number
  lastCheck: string | null
  lastMs: number | null
  lastError: string | null
}

export interface StatusIncident {
  id: string
  title: string
  body?: string
  startedAt: string
  resolvedAt: string | null
  /** Opened by the service when a monitor went down */
  auto: boolean
  monitorId?: string
  cause?: string | null
}

export interface StatusDay { total: number; ok: number; ms: number }

export interface StatusOverview {
  installed: boolean
  running: boolean
  url: string | null
  exposure: StatusExposure | null
  config: StatusConfig | null
  updatedAt: string | null
  monitors: Record<string, StatusMonitorState>
  /** Monitor id → day (YYYY-MM-DD) → checks */
  history: Record<string, Record<string, StatusDay>>
  incidents: StatusIncident[]
}

export interface StatusPrecheck {
  docker: boolean
  compose: boolean
  /** Among 80 and 443 */
  busyPorts: number[]
  /** DevForge's n8n runs with its Caddy */
  n8nCaddy: boolean
  installed: boolean
  /** Among 80 and 443: closed by an active ufw (Let's Encrypt and visitors cannot come in) */
  firewallBlocks: number[]
  /** status.<ip>.sslip.io, null when the server's address is not an IPv4 */
  sslip: string | null
  /** What DevForge proposes from the above */
  suggested: StatusExposure
}

export interface StatusInstallOptions {
  exposure: StatusExposure
  /** caddy and n8n: the page's address */
  domain: string
  /** caddy: for the certificate (Let's Encrypt) */
  email: string
}

export interface StatusAPI {
  precheck: (connectionId: string) => Promise<StatusPrecheck>
  checkDomain: (connectionId: string, domain: string) => Promise<{ ok: boolean; domainIps: string[]; serverIps: string[] }>
  install: (connectionId: string, opts: StatusInstallOptions) => Promise<{ ok: boolean }>
  onLog: (callback: (e: { connectionId: string; text: string }) => void) => () => void
  overview: (connectionId: string) => Promise<StatusOverview>
  saveConfig: (connectionId: string, config: StatusConfig) => Promise<void>
  /** Manual incidents (written by DevForge, shown on the page) */
  saveIncidents: (connectionId: string, incidents: StatusIncident[]) => Promise<void>
  /** Sent from this PC, to check the topic or the webhook */
  testAlert: (alerts: StatusAlerts) => Promise<void>
  /** Opens 80 and 443 in ufw on the server */
  openFirewall: (connectionId: string) => Promise<{ ok: boolean; output: string }>
  uninstall: (connectionId: string) => Promise<{ ok: boolean }>
}
