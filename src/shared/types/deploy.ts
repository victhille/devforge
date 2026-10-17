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

/** A git checkout found on a server, ready to become a deploy target */
export interface DetectedDeploy {
  remotePath: string
  origin: string | null
  branch: string | null
  pm2App: string | null
  /** Human name of the script preset that was picked */
  preset: string
  script: string
  /** Local project with the same git origin, if any */
  projectPath: string | null
  projectName: string | null
}

export interface DeployAPI {
  targets: () => Promise<DeployTarget[]>
  save:    (target: DeployTarget) => Promise<void>
  remove:  (id: string) => Promise<void>
  /** Starts a deployment, returns the run id; progress comes through events */
  run:     (targetId: string) => Promise<string>
  history: (targetId: string) => Promise<DeployRun[]>
  /** Scan a server for git checkouts / PM2 apps (read-only) */
  detect:  (sshConnectionId: string) => Promise<DetectedDeploy[]>
  onLog:    (cb: (e: { runId: string; text: string }) => void) => () => void
  onStatus: (cb: (run: DeployRun) => void) => () => void
}
