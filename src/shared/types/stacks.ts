// ─── Stack launcher ──────────────────────────────────────────────────────────

export type StackStepType = 'command' | 'vscode' | 'url'

export interface StackStep {
  id: string
  type: StackStepType
  /** Display name, e.g. "API" */
  label: string
  /** command: shell command; vscode: folder; url: address */
  command?: string
  cwd?: string
  url?: string
  /** url: wait before opening (ms), so dev servers have time to start */
  delayMs?: number
}

export interface Stack {
  id: string
  name: string
  color: string
  steps: StackStep[]
}

export type ProcessStatus = 'running' | 'exited' | 'failed' | 'stopped'

export interface ProcessInfo {
  /** `${stackId}:${stepId}` */
  key: string
  status: ProcessStatus
  pid: number | null
  exitCode: number | null
  startedAt: string
}

export interface ProcessLog {
  key: string
  stream: 'stdout' | 'stderr' | 'system'
  text: string
}

export interface StacksAPI {
  list:   () => Promise<Stack[]>
  save:   (stack: Stack) => Promise<void>
  remove: (id: string) => Promise<void>
  /** Run every step of a stack (long-running commands stay attached) */
  start:  (id: string) => Promise<void>
  stop:   (id: string) => Promise<void>
  stopStep:  (stackId: string, stepId: string) => Promise<void>
  startStep: (stackId: string, stepId: string) => Promise<void>
  processes: () => Promise<ProcessInfo[]>
  /** Last lines kept in memory for a process */
  logs: (key: string) => Promise<ProcessLog[]>
  onLog:    (cb: (log: ProcessLog) => void) => () => void
  onStatus: (cb: (info: ProcessInfo) => void) => () => void
}
