// ─── Deploy to VPS ───────────────────────────────────────────────────────────

export interface DeployTarget {
  id: string
  name: string
  /** SSH connection used to reach the server */
  connectionId: string
  /** Folder on the server where the script runs */
  remotePath: string
  /** Shell script, one command per line, stops at the first error */
  script: string
  /** Local project to `git push` before deploying (optional) */
  projectPath?: string
  pushFirst?: boolean
}

export type DeployStatus = 'running' | 'success' | 'failed'

export interface DeployRun {
  id: string
  targetId: string
  status: DeployStatus
  startedAt: string
  finishedAt: string | null
  exitCode: number | null
  /** Full output (truncated to the last 100 KB) */
  log: string
}

export interface DeployAPI {
  targets: () => Promise<DeployTarget[]>
  save:    (target: DeployTarget) => Promise<void>
  remove:  (id: string) => Promise<void>
  /** Starts a deployment, returns the run id; progress comes through events */
  run:     (targetId: string) => Promise<string>
  history: (targetId: string) => Promise<DeployRun[]>
  onLog:    (cb: (e: { runId: string; text: string }) => void) => () => void
  onStatus: (cb: (run: DeployRun) => void) => () => void
}
