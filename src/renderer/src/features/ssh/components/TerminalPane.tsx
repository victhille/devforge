import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WifiOff } from 'lucide-react'
import type { SSHSessionStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Spinner from '@renderer/components/ui/Spinner'
import '@xterm/xterm/css/xterm.css'

const XTERM_THEME = {
  background:  '#090B10',
  foreground:  '#D4D4D4',
  cursor:      '#4F8EF7',
  selectionBackground: 'rgba(79,142,247,0.3)',
  black:       '#1E2435', brightBlack:   '#4A5068',
  red:         '#F7615A', brightRed:     '#FF7875',
  green:       '#3DD68C', brightGreen:   '#5EF9A8',
  yellow:      '#F5A623', brightYellow:  '#FFD666',
  blue:        '#4F8EF7', brightBlue:    '#74AAFF',
  magenta:     '#A78BFA', brightMagenta: '#C4B5FD',
  cyan:        '#38BDF8', brightCyan:    '#7DD3FC',
  white:       '#CBD5E1', brightWhite:   '#F1F5F9'
}

interface Props {
  sessionId: string
  status: SSHSessionStatus['status']
  error?: string
  active: boolean
}

/** xterm.js terminal wired to one SSH session. Stays mounted while hidden. */
export default function TerminalPane({ sessionId, status, error, active }: Props) {
  const { t } = useI18n()
  const containerRef = useRef<HTMLDivElement>(null)
  const fitRef       = useRef<FitAddon | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: XTERM_THEME,
      fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', monospace",
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)
    fit.fit()
    fitRef.current = fit

    const unsub = window.devforge.onSshData((sid, data) => { if (sid === sessionId) term.write(data) })
    const input = term.onData(data => window.devforge.sshWrite(sessionId, data))

    const ro = new ResizeObserver(() => {
      fit.fit()
      window.devforge.sshResize(sessionId, term.cols, term.rows)
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      unsub()
      input.dispose()
      term.dispose()
      fitRef.current = null
    }
  }, [sessionId])

  // Re-fit when the pane becomes visible
  useEffect(() => {
    if (!active) return
    const id = setTimeout(() => fitRef.current?.fit(), 50)
    return () => clearTimeout(id)
  }, [active])

  return (
    <div className={cn('absolute inset-0 bg-[#090B10] p-2', !active && 'invisible')}>
      {status !== 'connected' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 text-sm">
          {status === 'connecting' ? (
            <><Spinner className="size-5" /><span className="text-fg-secondary">{t.ssh.connecting}</span></>
          ) : (
            <>
              <WifiOff size={20} className={status === 'error' ? 'text-danger' : 'text-fg-muted'} />
              <span className={status === 'error' ? 'text-danger' : 'text-fg-muted'}>
                {status === 'error' ? error ?? t.ssh.disconnected : t.ssh.disconnected}
              </span>
            </>
          )}
        </div>
      )}
      <div ref={containerRef} className={cn('h-full w-full', status !== 'connected' && 'opacity-0')} />
    </div>
  )
}
