import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import type { CommandResult, SfCommand } from '@shared/types'
import { sfCommandLine } from '@shared/lib/symfonyCommands'
import { useConsole } from '@renderer/app/ConsoleContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { isDbAuthError } from '@shared/lib/projectSetup'
import { useI18n } from '@renderer/i18n/I18nContext'

export const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** A workshop panel: title, a line of help, actions on the right */
export function Section({ title, help, actions, children, className }: { title: string; help?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-4 p-5', className)}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-md font-semibold text-fg">{title}</h2>
          {help && <p className="mt-0.5 text-sm text-fg-secondary">{help}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  )
}

/** Why a database refuses its password, most often: an old Docker volume of the same name */
export function DbAuthHint({ error, envFile }: { error: string | null | undefined; envFile: string }) {
  const { t } = useI18n()
  if (!isDbAuthError(error)) return null
  return (
    <p role="note" className="rounded-xl bg-warning/10 p-3 text-sm text-fg">
      {t.symfony.dbAuthHint.replace('{file}', envFile)}
    </p>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

/** A button with the exact command line it runs under it (any workshop) */
export function RunButton({ label, line, onRun, variant = 'secondary', disabled, title }: {
  label: string; line: string; onRun: () => void; variant?: Variant; disabled?: boolean; title?: string
}) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="sm" variant={variant} disabled={disabled} title={title} onClick={onRun}>{label}</Button>
      {line && <code className="max-w-[360px] truncate font-mono text-[11px] text-fg-muted" title={line}>{line}</code>}
    </span>
  )
}

/** A Symfony command button */
export function CommandButton({ command, arg, label, onRun, variant = 'secondary', disabled, title }: {
  command: SfCommand; arg?: string; label: string; onRun: (command: SfCommand, arg?: string) => void
  variant?: Variant; disabled?: boolean; title?: string
}) {
  return <RunButton label={label} line={sfCommandLine(command, arg)} onRun={() => onRun(command, arg)} variant={variant} disabled={disabled} title={title} />
}

/**
 * Runs workshop commands in the console and calls `onDone` once each one ends
 * (results are kept in case one arrives before its task id is known).
 */
export function useSfTasks(projectPath: string, label: (command: string) => string, onDone: (ok: boolean) => void) {
  const { runTask } = useConsole()
  const mine = useRef(new Set<string>())
  const early = useRef(new Map<string, CommandResult>())
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => window.devforge.onTaskResult(r => {
    if (mine.current.delete(r.taskId)) done.current(r.status === 'success')
    else { early.current.set(r.taskId, r); if (early.current.size > 20) early.current.delete(early.current.keys().next().value!) }
  }), [])

  const track = useCallback(async (title: string, start: () => Promise<string>) => {
    try {
      const id = await runTask(title, projectPath, start)
      const r = early.current.get(id)
      if (r) { early.current.delete(id); done.current(r.status === 'success') } else mine.current.add(id)
    } catch { /* the console shows the error */ }
  }, [projectPath, runTask])

  const exec = useCallback((command: SfCommand, arg?: string) =>
    track(label(sfCommandLine(command, arg)), () => window.devforge.symfony.run(projectPath, command, arg)), [label, projectPath, track])

  return { exec, track }
}
