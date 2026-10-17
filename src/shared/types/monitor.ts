// ─── URL monitor ─────────────────────────────────────────────────────────────

export interface Monitor {
  id: string
  name: string
  url: string
  /** Seconds between checks (min 30) */
  intervalSec: number
  enabled: boolean
  /** Optional text the response body must contain */
  keyword?: string
}

export interface MonitorCheck {
  at: string
  ok: boolean
  /** ms, null when the request failed */
  latency: number | null
  statusCode: number | null
  error?: string
}

export interface MonitorState {
  id: string
  status: 'up' | 'down' | 'unknown'
  /** Most recent first, at most 60 */
  checks: MonitorCheck[]
  /** When the current status started */
  since: string | null
}

export interface MonitorAPI {
  list:   () => Promise<Monitor[]>
  states: () => Promise<MonitorState[]>
  save:   (m: Monitor) => Promise<void>
  remove: (id: string) => Promise<void>
  checkNow: (id: string) => Promise<MonitorState>
  onState: (cb: (s: MonitorState) => void) => () => void
}
