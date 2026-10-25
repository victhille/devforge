import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { MarkerParser } from '@shared/lib/shellBlocks'
import type { ShellBackend } from './backends'
import { XTERM_THEME, snapshot, type Line } from './snapshot'

export interface Block {
  id: number
  cmd: string
  cwd: string
  startedAt: number
  endedAt: number | null
  /** null: unknown (cmd) or still running */
  code: number | null
  /** Settled screen once finished */
  lines: Line[] | null
}

export type ShellState = 'starting' | 'ready' | 'running' | 'exited'

const MAX_BLOCKS = 200
const COLS = 120, ROWS = 24

/**
 * One shell seen as blocks. While a command runs its output goes to a live
 * xterm (programs that ask something, Ctrl+C, colors work as usual); when the
 * prompt comes back, the screen is settled into colored lines and the xterm
 * goes away.
 */
export function useBlockShell(backend: ShellBackend) {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [state, setState] = useState<ShellState>('starting')
  const [cwd, setCwd] = useState('')
  /** The running block's terminal: the view opens it in the page */
  const [live, setLive] = useState<Terminal | null>(null)

  const parser = useRef(new MarkerParser())
  const phase = useRef<ShellState>('starting')
  const inPrompt = useRef(false)
  const running = useRef<{ block: Block; term: Terminal } | null>(null)
  const code = useRef<number | null>(null)
  const cwdRef = useRef('')
  const nextId = useRef(1)
  const size = useRef({ cols: COLS, rows: ROWS })

  const setPhase = (p: ShellState) => { phase.current = p; setState(p) }

  /** Prompt back: the block's screen is settled once xterm has parsed everything */
  const finish = useCallback(() => {
    const r = running.current
    if (!r) return
    running.current = null
    const exit = code.current
    r.term.write('', () => {
      const done: Block = { ...r.block, endedAt: Date.now(), code: exit, lines: snapshot(r.term, r.block.cmd) }
      r.term.dispose()
      setLive(null)
      setBlocks(list => list.map(b => b.id === done.id ? done : b))
      window.devforge.terminal.addHistory(backend.historyKey, { cmd: done.cmd, at: new Date().toISOString(), code: exit }).catch(() => {})
    })
  }, [backend])

  useEffect(() => {
    let stopped = false
    const onData = (data: string) => {
      for (const e of parser.current.feed(data)) {
        // A: the output ends here; the exit code (D) and folder (P) follow, the block closes at B
        if (e.type === 'prompt-start') inPrompt.current = true
        else if (e.type === 'exit-code') code.current = e.code
        else if (e.type === 'cwd') { cwdRef.current = e.path; setCwd(e.path) }
        else if (e.type === 'prompt-end') {
          inPrompt.current = false
          if (phase.current === 'running') finish()
          if (phase.current !== 'exited') setPhase('ready')
        } else if (e.type === 'data' && !inPrompt.current && phase.current === 'running') running.current?.term.write(e.text)
      }
    }
    const onExit = () => {
      if (stopped) return
      finish()
      setPhase('exited')
    }
    backend.start(onData, onExit, size.current.cols, size.current.rows).catch(() => onExit())
    return () => {
      stopped = true
      backend.stop()
      running.current?.term.dispose()
      running.current = null
    }
  }, [backend, finish])

  const run = useCallback((cmd: string) => {
    if (phase.current !== 'ready' || !cmd.trim()) return
    const term = new Terminal({
      theme: XTERM_THEME, cols: size.current.cols, rows: size.current.rows, scrollback: 5000,
      fontFamily: "'Geist Mono Variable', 'Cascadia Code', Consolas, monospace", fontSize: 12.5, lineHeight: 1.3,
      cursorBlink: true, convertEol: false, allowProposedApi: true
    })
    const block: Block = { id: nextId.current++, cmd, cwd: cwdRef.current, startedAt: Date.now(), endedAt: null, code: null, lines: null }
    code.current = null
    running.current = { block, term }
    setLive(term)
    setBlocks(list => [...list.slice(-(MAX_BLOCKS - 1)), block])
    setPhase('running')
    backend.write(`${cmd}\r`)
  }, [backend])

  /** Ctrl+C to the running program */
  const interrupt = useCallback(() => backend.write('\x03'), [backend])
  /** Keys typed in the live block go to the program */
  const send = useCallback((data: string) => backend.write(data), [backend])

  const resize = useCallback((cols: number, rows: number) => {
    if (cols === size.current.cols && rows === size.current.rows) return
    size.current = { cols, rows }
    running.current?.term.resize(cols, rows)
    backend.resize(cols, rows)
  }, [backend])

  const clear = useCallback(() => setBlocks(list => list.filter(b => b.endedAt === null)), [])

  return { blocks, state, cwd, live, run, interrupt, send, resize, clear }
}
