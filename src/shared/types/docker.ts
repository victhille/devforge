// ─── Docker (local) ──────────────────────────────────────────────────────────

export interface DockerContainer {
  id: string
  name: string
  image: string
  /** running, exited, paused, created, restarting, dead */
  state: string
  /** Human status, e.g. "Up 3 hours" */
  status: string
  ports: string
  /** Compose project the container belongs to, if any */
  composeProject: string | null
  createdAt: string
}

export interface DockerImage {
  id: string
  repository: string
  tag: string
  size: string
  createdSince: string
}

export interface ComposeProject {
  name: string
  /** e.g. "running(2)", "exited(1)" */
  status: string
  configFiles: string
}

export interface DockerOverview {
  /** false when the CLI is missing or the daemon is not running */
  available: boolean
  error?: string
  version?: string
  containers: DockerContainer[]
  images: DockerImage[]
  compose: ComposeProject[]
}

export type ContainerAction = 'start' | 'stop' | 'restart' | 'remove'

export interface DockerAPI {
  overview: () => Promise<DockerOverview>
  container: (id: string, action: ContainerAction) => Promise<{ ok: boolean; output: string }>
  compose: (name: string, configFiles: string, action: 'up' | 'down' | 'restart') => Promise<{ ok: boolean; output: string }>
  /** Removes stopped containers, dangling images, unused networks and build cache */
  prune: () => Promise<{ ok: boolean; output: string }>
  /** Streams `docker logs -f` into the process log channel under key `docker:<id>` */
  followLogs: (id: string) => Promise<string>
  stopLogs: (id: string) => Promise<void>
}
