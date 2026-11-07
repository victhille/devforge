import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import type { ModelProgress } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import { fill } from './model'

const STEPS = ['connect', 'read', 'mcd', 'mpd', 'write'] as const

/** v4.1: a model made from a database, step by step (the main process reports each one) */
export function useModelImport() {
  const [progress, setProgress] = useState<ModelProgress | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const job = useRef('')
  /** What each step said (the connection's name, the tables read) */
  const [details, setDetails] = useState<Partial<Record<ModelProgress['step'], string>>>({})

  useEffect(() => window.devforge.modeling.onProgress(e => {
    if (e.job !== job.current) return
    setProgress(e)
    if (e.detail) setDetails(d => ({ ...d, [e.step]: e.detail }))
  }), [])

  const run = useCallback(async (projectPath: string, connectionId: string, name: string) => {
    job.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setBusy(true); setError(''); setDetails({})
    setProgress({ step: 'connect', index: 0, total: STEPS.length })
    try { return await window.devforge.modeling.fromDatabase(projectPath, connectionId, name, job.current) }
    catch (err) { setError(errorText(err)); return null }
    finally { setBusy(false) }
  }, [])

  const reset = useCallback(() => { setProgress(null); setError(''); setDetails({}) }, [])
  return { progress, details, error, busy, run, reset }
}

/** The steps, the bar, and where it stopped when it failed */
export function ImportProgress({ progress, details, error, className }: {
  progress: ModelProgress | null; details: Partial<Record<ModelProgress['step'], string>>; error: string; className?: string
}) {
  const { t } = useI18n()
  const l = t.modeling.linked
  if (!progress) return null
  const done = progress.step === 'done'
  // The running step counts half
  const pct = done ? 100 : Math.round(((progress.index + (error ? 0 : 0.5)) / STEPS.length) * 100)
  return (
    <div className={cn('flex flex-col gap-2.5', className)} role="status" aria-live="polite" aria-label={l.progressLabel}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-fg">{l.progressLabel}</span>
        <span className="font-mono text-xs text-fg-muted">{pct} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-active" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className={cn('h-full rounded-full transition-[width] duration-300', error ? 'bg-danger' : done ? 'bg-success' : 'bg-accent')} style={{ width: `${pct}%` }} />
      </div>
      <ol className="flex flex-col gap-1 text-sm">
        {STEPS.map((s, i) => {
          const state = done || i < progress.index ? 'done' : i === progress.index ? (error ? 'failed' : 'running') : 'waiting'
          return (
            <li key={s} data-step={s} data-state={state} className={cn('flex items-center gap-2', state === 'waiting' ? 'text-fg-muted' : state === 'failed' ? 'text-danger' : 'text-fg-secondary')}>
              {state === 'done' ? <Check size={14} className="shrink-0 text-success" />
                : state === 'running' ? <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
                : state === 'failed' ? <X size={14} className="shrink-0" />
                : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-line" />}
              {fill(l.progress[s], { detail: details[s] ?? '' }).trim()}
            </li>
          )
        })}
      </ol>
      {done && <p className="text-sm font-medium text-success">{l.progress.done}</p>}
      {error && <p role="alert" className="text-sm text-danger">{l.importFailed} : {error}</p>}
    </div>
  )
}
