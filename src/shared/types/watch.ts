// ─── Background watch: VPS state, history, alerts ─────────────────────────────

export interface HistoryPoint {
  /** Start of the bucket (epoch ms) */
  t: number
  /** One value per field, null when nothing was measured */
  v: (number | null)[]
}

export interface HistorySeries {
  fields: string[]
  points: HistoryPoint[]
}

/** Last known state of a watched server */
export interface VpsStatus {
  connectionId: string
  name: string
  /** connecting: first sample not in yet */
  state: 'ok' | 'down' | 'connecting'
  error?: string
  /** Time of the last sample (epoch ms) */
  at: number | null
  cpu: number | null
  memory: number | null
  disk: number | null
  containers: { name: string; image: string; status: string; running: boolean }[]
}

export interface WatchConfig {
  /** SSH connection ids watched in the background */
  watched: string[]
  /** Disk use (%) that raises an alert */
  diskAlert: number
  /** Which alerts notify (history is kept either way) */
  alerts: Record<AlertKind, boolean>
}

export type AlertKind = 'disk' | 'container' | 'server' | 'site'

export interface WatchAlert {
  kind: AlertKind
  title: string
  body: string
  at: number
}

/** A container or compose project on a VPS, read over SSH */
export interface RemoteContainer {
  id: string
  name: string
  image: string
  state: string
  status: string
  ports: string
  composeProject: string | null
}

export interface RemoteCompose {
  name: string
  status: string
  configFiles: string
}

export interface WatchAPI {
  status: () => Promise<VpsStatus[]>
  onStatus: (cb: (s: VpsStatus[]) => void) => () => void
  config: () => Promise<WatchConfig>
  saveConfig: (c: Partial<WatchConfig>) => Promise<WatchConfig>
  /** VPS or site history (`vps:<id>`, `site:<id>`) since `hours` ago, `bucketMin` minutes per point */
  history: (key: string, hours: number, bucketMin: number) => Promise<HistorySeries>
  onAlert: (cb: (a: WatchAlert) => void) => () => void
  /** Docker on a VPS, through the watch's SSH session */
  docker: (connectionId: string) => Promise<{ containers: RemoteContainer[]; compose: RemoteCompose[] }>
  dockerAction: (connectionId: string, target: { container?: string; compose?: RemoteCompose }, action: 'start' | 'stop' | 'restart' | 'up') => Promise<{ ok: boolean; output: string }>
  dockerLogs: (connectionId: string, container: string, lines: number) => Promise<string>
}
