import type { TerminalShell } from '@shared/types'
import { cmdLine, sshInitLine } from '@shared/lib/shellBlocks'

/** What the block view drives: a local shell or a server's, same shape */
export interface ShellBackend {
  /** Starts the shell; data and exit come through the callbacks */
  start: (onData: (data: string) => void, onExit: (code: number | null) => void, cols: number, rows: number) => Promise<void>
  write: (data: string) => void
  resize: (cols: number, rows: number) => void
  stop: () => void
  /** Where its commands' history is kept */
  historyKey: string
  /** The line typed for a command, when the shell needs more than the command (cmd and its exit code) */
  line?: (cmd: string, tag: string) => string
}

export function localBackend(kind: TerminalShell['kind'], cwd: string): ShellBackend {
  let id: string | null = null
  const unsubs: (() => void)[] = []
  return {
    historyKey: cwd,
    ...(kind === 'cmd' ? { line: cmdLine } : {}),
    async start(onData, onExit, cols, rows) {
      // Subscribed first: the first prompt may come before create() resolves
      const early: string[] = []
      unsubs.push(window.devforge.terminal.onData((tid, data) => { if (tid === id) onData(data); else if (id === null) early.push(data) }))
      unsubs.push(window.devforge.terminal.onExit((tid, code) => { if (tid === id) onExit(code) }))
      id = await window.devforge.terminal.create(kind, cwd, cols, rows)
      // Only this terminal's: ids are unique, and nothing else was created meanwhile by this view
      for (const d of early.splice(0)) onData(d)
    },
    write: data => { if (id) window.devforge.terminal.write(id, data) },
    resize: (cols, rows) => { if (id) window.devforge.terminal.resize(id, cols, rows) },
    stop: () => { for (const u of unsubs.splice(0)) u(); if (id) window.devforge.terminal.kill(id); id = null }
  }
}

/** The server's shell through DevForge's SSH session; bash learns the markers at the start */
export function sshBackend(connectionId: string): ShellBackend {
  let sid: string | null = null
  const unsubs: (() => void)[] = []
  return {
    historyKey: `ssh:${connectionId}`,
    async start(onData, onExit, cols, rows) {
      let taught = false
      unsubs.push(window.devforge.onSshData((s, data) => {
        if (s !== sid) return
        // The shell is up when it first writes (the "connected" status comes before it): teach it the markers then
        if (!taught) {
          taught = true
          window.devforge.sshResize(s, cols, rows)
          window.devforge.sshWrite(s, sshInitLine())
        }
        onData(data)
      }))
      unsubs.push(window.devforge.onSshStatus(st => {
        if (st.sessionId === sid && (st.status === 'disconnected' || st.status === 'error')) onExit(null)
      }))
      sid = await window.devforge.sshConnect(connectionId)
    },
    write: data => { if (sid) window.devforge.sshWrite(sid, data) },
    resize: (cols, rows) => { if (sid) window.devforge.sshResize(sid, cols, rows) },
    stop: () => { for (const u of unsubs.splice(0)) u(); if (sid) window.devforge.sshDisconnect(sid); sid = null }
  }
}
