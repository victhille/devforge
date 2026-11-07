// ─── Log file viewer ─────────────────────────────────────────────────────────

export interface LogTailOpen {
  id: string
  path: string
  /** Last lines of the file at open time */
  lines: string[]
  size: number
}

export interface LogsAPI {
  /** Start following a file (tail -f) */
  open:  (path: string) => Promise<LogTailOpen>
  close: (id: string) => Promise<void>
  /** v4.0: a file outside the projects, chosen in the file dialog (and allowed from then on) */
  pick: () => Promise<string | null>
  onLines: (cb: (e: { id: string; lines: string[]; reset?: boolean }) => void) => () => void
}
