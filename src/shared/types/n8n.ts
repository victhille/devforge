// ─── n8n on a VPS: install, follow, workflows ─────────────────────────────────

/** How n8n is reached from the outside */
export type N8nExposure =
  /** Caddy in front, HTTPS on a sub-domain (needs ports 80 and 443 free) */
  | 'caddy'
  /** Only on the server (127.0.0.1:5678): an existing proxy or an SSH tunnel serves it */
  | 'local'

export interface N8nInstance {
  connectionId: string
  /** "n8n.example.com", empty in 'local' mode */
  domain: string
  exposure: N8nExposure
  installedAt: string
  /** An API key is saved (encrypted, never sent to the window) */
  hasKey: boolean
}

/** What the server offers before an install */
export interface N8nPrecheck {
  docker: string | null
  compose: boolean
  /** Ports 80 / 443 already taken (another web server) */
  busyPorts: number[]
  /** ~/devforge/n8n already exists */
  existing: boolean
}

/** Does the sub-domain point to the server? */
export interface N8nDomainCheck {
  ok: boolean
  /** What public DNS answers for the sub-domain (empty: it does not exist) */
  domainIps: string[]
  serverIps: string[]
}

export interface N8nStatus {
  installed: boolean
  /** n8n container state ("running", "exited"…), null when absent */
  state: string | null
  version: string | null
  containers: { name: string; state: string; status: string }[]
  /** https://<domain> in 'caddy' mode */
  url: string | null
}

export interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  updatedAt: string
  tags: string[]
}

export interface N8nExecution {
  id: string
  workflowId: string
  workflowName: string
  status: string
  startedAt: string
  stoppedAt: string | null
  mode: string
}

export interface N8nAPI {
  instances: () => Promise<N8nInstance[]>
  precheck: (connectionId: string) => Promise<N8nPrecheck>
  /** Writes ~/devforge/n8n and starts it; output streams on `onLog` */
  install: (connectionId: string, opts: { domain: string; exposure: N8nExposure; email: string }) => Promise<{ ok: boolean }>
  onLog: (cb: (e: { connectionId: string; text: string }) => void) => () => void
  /** Checked again by `install` in 'caddy' mode */
  checkDomain: (connectionId: string, domain: string) => Promise<N8nDomainCheck>
  status: (connectionId: string) => Promise<N8nStatus>
  /** 'local' mode: a tunnel from this PC through DevForge's SSH session; returns its http://localhost URL */
  openTunnel: (connectionId: string) => Promise<string>
  logs: (connectionId: string, lines: number) => Promise<string>
  /** Database dump in ~/devforge/n8n/backups, then a newer image */
  update: (connectionId: string) => Promise<{ ok: boolean }>
  /** Starts / stops / restarts the stack */
  control: (connectionId: string, action: 'start' | 'stop' | 'restart') => Promise<{ ok: boolean; output: string }>
  saveKey: (connectionId: string, apiKey: string | null) => Promise<N8nInstance>
  /** Forgets the server in DevForge (nothing is removed from it) */
  forget: (connectionId: string) => Promise<void>
  workflows: (connectionId: string) => Promise<N8nWorkflow[]>
  executions: (connectionId: string, onlyErrors: boolean) => Promise<N8nExecution[]>
  setActive: (connectionId: string, workflowId: string, active: boolean) => Promise<N8nWorkflow>
  /** Saves the workflow as n8n/<name>.json in a project, to version it with Git */
  exportWorkflow: (connectionId: string, workflowId: string, projectId: string) => Promise<string>
}
