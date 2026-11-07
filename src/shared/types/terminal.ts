// ─── Terminal in blocks (v2.2 lot 5) ──────────────────────────────────────────

import type { ShellKind } from '../lib/shellBlocks'

export interface TerminalShell {
  kind: Exclude<ShellKind, 'ssh'>
  label: string
  available: boolean
}

export interface TerminalHistoryEntry {
  cmd: string
  at: string
  /** null: unknown (cmd) or still running */
  code: number | null
}

export interface TerminalAPI {
  shells: () => Promise<TerminalShell[]>
  /** A local shell in this folder; its output comes through onData */
  create: (kind: TerminalShell['kind'], cwd: string, cols: number, rows: number) => Promise<string>
  write: (id: string, data: string) => Promise<void>
  resize: (id: string, cols: number, rows: number) => Promise<void>
  kill: (id: string) => Promise<void>
  onData: (callback: (id: string, data: string) => void) => () => void
  onExit: (callback: (id: string, code: number) => void) => () => void
  /** Commands run in a folder (or on a server: "ssh:<connection id>") */
  history: (key: string) => Promise<TerminalHistoryEntry[]>
  addHistory: (key: string, entry: TerminalHistoryEntry) => Promise<void>
}
