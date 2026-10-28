import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronUp, ChevronDown, CheckCircle2, XCircle, FolderOpen, Code2, ArrowRight, Maximize2, Minimize2, Copy, Check } from 'lucide-react'
import type { LogLine } from '@shared/types'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'

const LOG_COLOR: Record<LogLine['type'], string> = {
  stdout: 'text-fg-secondary',
  stderr: 'text-warning',
  info:   'text-accent',
  error:  'text-danger'
}

const HEADER = 38
const MIN_HEIGHT = 140
const HEIGHT_KEY = 'df.console.height'

/** A setup step's line: "▸ [7/16] Démarrage de la base" */
const STEP_RE = /^▸ \[(\d+)\/(\d+)\] (.+)$/

function readHeight(): number {
  try { return Math.max(MIN_HEIGHT, Number(localStorage.getItem(HEIGHT_KEY)) || 280) } catch { return 280 }
}

function FooterButton({ onClick, className, children }: { onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-elevated px-2.5 py-1 text-xs',
        'text-fg-secondary transition-colors hover:bg-hover hover:text-fg',
        className
      )}
    >
      {children}
    </button>
  )
}

/** One log line: steps as section titles, commands with their prompt, counts of hidden lines muted */
function Line({ log }: { log: LogLine }) {
  const step = log.type === 'info' ? STEP_RE.exec(log.text) : null
  if (step) {
    return (
      <div className="mb-1 mt-3 flex items-center gap-2 border-t border-line-subtle pt-2.5 font-sans first:mt-0 first:border-t-0 first:pt-0">
        <span className="rounded bg-accent-soft px-1.5 py-px font-mono text-[10.5px] font-semibold text-accent">{step[1]}/{step[2]}</span>
        <span className="text-[12.5px] font-semibold text-fg">{step[3]}</span>
      </div>
    )
  }
  if (log.type === 'info' && log.text.startsWith('> ')) {
    return (
      <div className="whitespace-pre-wrap break-all text-fg">
        <span className="select-none text-accent">❯ </span>{log.text.slice(2)}
      </div>
    )
  }
  if (log.text.startsWith('… (+')) return <div className="italic text-fg-muted">{log.text}</div>
  return <div className={cn('whitespace-pre-wrap break-all', LOG_COLOR[log.type])}>{log.text}</div>
}

export default function BottomPanel() {
  const { t } = useI18n()
  const {
    visible, minimized, label, logs, result, isCreation, taskId, projectId,
    cancelTask, hide, setMinimized, openFolder, openVSCode
  } = useConsole()

  const navigate = useNavigate()
  const logEndRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(readHeight)
  const [maximized, setMaximized] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)
  const running = visible && result === null && taskId !== null

  useEffect(() => {
    if (!minimized) logEndRef.current?.scrollIntoView({ block: 'end' })
  }, [logs, minimized])

  // A project just created: straight to its page
  const shownProject = useRef<string | null>(null)
  useEffect(() => {
    if (isCreation && result?.status === 'success' && projectId && shownProject.current !== projectId) {
      shownProject.current = projectId
      navigate(`/project/${projectId}`)
    }
  }, [isCreation, result, projectId, navigate])

  // The step being run, from the last "▸ [i/n]" line
  const step = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i--) {
      const m = logs[i].type === 'info' ? STEP_RE.exec(logs[i].text) : null
      if (m) return { at: Number(m[1]), of: Number(m[2]), label: m[3] }
    }
    return null
  }, [logs])

  function startResize(e: ReactPointerEvent) {
    if (minimized) return
    e.preventDefault()
    const startY = e.clientY, startH = maximized ? Math.round(window.innerHeight * 0.85) : height
    setMaximized(false)
    setDragging(true)
    const move = (ev: PointerEvent) => {
      setHeight(Math.min(Math.round(window.innerHeight * 0.85), Math.max(MIN_HEIGHT, startH + startY - ev.clientY)))
    }
    const up = () => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setHeight(h => { try { localStorage.setItem(HEIGHT_KEY, String(h)) } catch { /* ignore */ } return h })
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  async function copyLog() {
    try {
      await navigator.clipboard.writeText(logs.map(l => l.text).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  const statusClass = !result ? 'text-accent'
    : result.status === 'success'   ? 'text-success'
    : result.status === 'cancelled' ? 'text-warning'
    : 'text-danger'

  const statusLabel = !result ? null
    : result.status === 'success'   ? t.console.done
    : result.status === 'cancelled' ? t.console.cancelled
    : t.console.failed

  const progress = !step ? null : result?.status === 'success' ? 1 : (step.at - (running ? 1 : 0)) / step.of
  const panelHeight = !visible ? 0 : minimized ? HEADER : maximized ? '85vh' : height

  return (
    <div
      style={{ height: panelHeight }}
      className={cn(
        'relative flex shrink-0 flex-col overflow-hidden border-t border-line-subtle bg-console shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)]',
        !dragging && 'transition-[height] duration-200'
      )}
    >
      {/* Drag the top edge to resize */}
      {!minimized && (
        <div
          onPointerDown={startResize}
          onDoubleClick={() => setMaximized(m => !m)}
          title={t.console.resize}
          className={cn('absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize transition-colors hover:bg-accent/40', dragging && 'bg-accent/60')}
        />
      )}

      {/* Header / status bar */}
      <div
        onClick={() => { if (minimized) setMinimized(false) }}
        style={{ height: HEADER }}
        className={cn('relative flex shrink-0 items-center justify-between border-b border-line-subtle bg-surface px-3', minimized && 'cursor-pointer')}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {running && <Spinner />}
          {result?.status === 'success' && <CheckCircle2 size={14} className="shrink-0 text-success" />}
          {result && result.status !== 'success' && <XCircle size={14} className={cn('shrink-0', statusClass)} />}
          <span className="truncate text-sm font-semibold text-fg">{label}</span>
          {statusLabel && <span className={cn('shrink-0 rounded-full px-2 py-px text-[11px] font-medium', statusClass, 'bg-elevated')}>{statusLabel}</span>}
          {step && running && (
            <span className="min-w-0 truncate text-xs text-fg-muted">
              {t.console.step.replace('{i}', String(step.at)).replace('{n}', String(step.of))} · {step.label}
            </span>
          )}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          {running && (
            <IconButton size="sm" title={t.console.cancel} onClick={e => { e.stopPropagation(); cancelTask() }}>
              <X size={12} />
            </IconButton>
          )}
          {!minimized && logs.length > 0 && (
            <IconButton size="sm" title={copied ? t.console.copied : t.console.copy} onClick={e => { e.stopPropagation(); copyLog() }}>
              {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            </IconButton>
          )}
          {!minimized && (
            <IconButton size="sm" title={maximized ? t.console.restore : t.console.maximize} onClick={e => { e.stopPropagation(); setMaximized(m => !m) }}>
              {maximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </IconButton>
          )}
          <IconButton
            size="sm"
            title={minimized ? t.console.expand : t.console.minimize}
            onClick={e => { e.stopPropagation(); setMinimized(!minimized) }}
          >
            {minimized ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </IconButton>
          <IconButton size="sm" title={t.console.close} onClick={e => { e.stopPropagation(); hide() }}>
            <X size={12} />
          </IconButton>
        </div>

        {progress !== null && (
          <div className="absolute inset-x-0 bottom-0 h-0.5 bg-line-subtle">
            <div className={cn('h-full transition-[width] duration-300', result?.status === 'failed' ? 'bg-danger' : result ? 'bg-success' : 'bg-accent')} style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        )}
      </div>

      {/* Log output */}
      <div role="log" tabIndex={0} aria-label={t.console.output} className="flex-1 overflow-y-auto px-4 py-2.5 font-mono text-[11.5px] leading-[1.7]">
        {logs.map((log, i) => <Line key={i} log={log} />)}
        <div ref={logEndRef} />
      </div>

      {/* Footer on completion */}
      {result && (
        <div className="flex shrink-0 items-center gap-1.5 border-t border-line-subtle bg-surface px-3 py-1.5">
          {result.status === 'success' && isCreation && (
            <>
              <FooterButton onClick={openFolder}><FolderOpen size={11} /> {t.console.openFolder}</FooterButton>
              <FooterButton onClick={openVSCode}><Code2 size={11} /> {t.console.openVSCode}</FooterButton>
              {projectId && <FooterButton onClick={() => { navigate(`/project/${projectId}`); setMinimized(true) }}><ArrowRight size={11} /> {t.console.openProject}</FooterButton>}
            </>
          )}
          <span className="ml-auto font-mono text-[11px] text-fg-muted">{t.console.lines.replace('{n}', String(logs.length))}</span>
          <FooterButton onClick={hide}>{t.console.close}</FooterButton>
        </div>
      )}
    </div>
  )
}
