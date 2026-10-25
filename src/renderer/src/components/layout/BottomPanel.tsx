import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, ChevronUp, ChevronDown, CheckCircle2, XCircle, FolderOpen, Code2, ArrowRight } from 'lucide-react'
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

export default function BottomPanel() {
  const { t } = useI18n()
  const {
    visible, minimized, label, logs, result, isCreation, taskId, projectId,
    cancelTask, hide, setMinimized, openFolder, openVSCode
  } = useConsole()

  const navigate = useNavigate()
  const logEndRef = useRef<HTMLDivElement>(null)
  const running = visible && result === null && taskId !== null

  useEffect(() => {
    if (!minimized) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, minimized])

  const statusClass = !result ? 'text-accent'
    : result.status === 'success'   ? 'text-success'
    : result.status === 'cancelled' ? 'text-warning'
    : 'text-danger'

  const statusLabel = !result ? null
    : result.status === 'success'   ? t.console.done
    : result.status === 'cancelled' ? t.console.cancelled
    : t.console.failed

  return (
    <div
      className={cn(
        'flex shrink-0 flex-col overflow-hidden border-t border-line-subtle bg-console transition-[height] duration-200',
        !visible ? 'h-0' : minimized ? 'h-[34px]' : 'h-60'
      )}
    >
      {/* Header / status bar */}
      <div
        onClick={() => { if (minimized) setMinimized(false) }}
        className={cn(
          'flex h-[34px] shrink-0 items-center justify-between border-b border-line-subtle bg-surface px-3',
          minimized && 'cursor-pointer'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {running && <Spinner />}
          {result?.status === 'success' && <CheckCircle2 size={12} className="shrink-0 text-success" />}
          {result && result.status !== 'success' && <XCircle size={12} className={cn('shrink-0', statusClass)} />}
          <span className="truncate text-sm font-medium text-fg">{label}</span>
          {statusLabel && <span className={cn('shrink-0 text-xs font-medium', statusClass)}>— {statusLabel}</span>}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-0.5">
          {running && (
            <IconButton size="sm" title={t.console.cancel} onClick={e => { e.stopPropagation(); cancelTask() }}>
              <X size={11} />
            </IconButton>
          )}
          <IconButton
            size="sm"
            title={minimized ? t.console.expand : t.console.minimize}
            onClick={e => { e.stopPropagation(); setMinimized(!minimized) }}
          >
            {minimized ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </IconButton>
          <IconButton size="sm" title={t.console.close} onClick={e => { e.stopPropagation(); hide() }}>
            <X size={11} />
          </IconButton>
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto px-3.5 py-2 font-mono text-[11.5px] leading-[1.65]">
        {logs.map((log, i) => (
          <div key={i} className={cn('whitespace-pre-wrap break-all', LOG_COLOR[log.type])}>
            {log.text}
          </div>
        ))}
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
          <FooterButton onClick={hide} className="ml-auto">{t.console.close}</FooterButton>
        </div>
      )}
    </div>
  )
}
