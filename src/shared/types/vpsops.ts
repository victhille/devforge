// ─── VPS services (web interfaces in containers) and health checks ─────────────

/** A web interface published by a container on the server */
export interface VpsService {
  container: string
  image: string
  /** "Portainer", "phpMyAdmin"… or the container name for an unknown image */
  name: string
  /** Known service id (icon, scheme), 'other' otherwise */
  kind: string
  /** Port on the server (the host side of "127.0.0.1:9000->9000/tcp") */
  port: number
  scheme: 'http' | 'https'
  /** Published on all interfaces (0.0.0.0 / ::): reachable from the internet */
  exposed: boolean
  running: boolean
  status: string
}

export type HealthLevel = 'ok' | 'warn' | 'bad' | 'unknown'

/** What can be fixed from DevForge; the command is built in the main process from this id */
export type HealthFixId = 'apt-upgrade' | 'reboot' | 'docker-prune' | 'install-fail2ban' | 'ssh-harden'

export interface HealthCheck {
  /** "updates", "reboot", "disk"… also the i18n key of the title and texts */
  id: string
  level: HealthLevel
  /** Values for the text: {count}, {percent}… */
  values: Record<string, string | number>
  fix?: HealthFixId
}

export interface VpsHealth {
  checkedAt: string
  os: string | null
  uptime: string | null
  /** sudo works without a password: fixes can run from DevForge */
  sudo: boolean
  checks: HealthCheck[]
}

export interface VpsOpsAPI {
  services: (connectionId: string) => Promise<VpsService[]>
  /** Tunnel through the SSH session; returns the http(s)://localhost URL */
  openService: (connectionId: string, port: number, scheme: 'http' | 'https') => Promise<string>
  health: (connectionId: string) => Promise<VpsHealth>
  /** The exact command a fix runs, shown before it runs */
  fixCommand: (connectionId: string, fix: HealthFixId) => Promise<string>
  /** Runs a fix; output streams on `onFixLog` */
  runFix: (connectionId: string, fix: HealthFixId) => Promise<{ ok: boolean }>
  onFixLog: (cb: (e: { connectionId: string; text: string }) => void) => () => void
}
