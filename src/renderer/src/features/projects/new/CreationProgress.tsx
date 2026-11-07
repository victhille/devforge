import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'

/** The step lines the main process writes, "▸ [3/8] label" */
const STEP_RE = /^▸ \[(\d+)\/(\d+)\] /

/**
 * Where the creation started from the wizard stands, from the console's step lines:
 * the base project first, then the setup's "[i/n]" steps. Null when there is none.
 */
export function useCreationProgress() {
  const { logs, result, isCreation, creation, visible } = useConsole()
  const at = useMemo(() => {
    for (let i = logs.length - 1; i >= 0; i--) {
      const m = logs[i].type === 'info' ? STEP_RE.exec(logs[i].text) : null
      if (m) return Number(m[1])
    }
    return 0
  }, [logs])
  if (!isCreation || !creation) return null
  const ok = result?.status === 'success'
  const failed = !!result && !ok
  const total = creation.planned.length
  const done = ok ? total : at
  return {
    creation, at, done, total, ok, failed,
    finished: !!result,
    /** Still worth showing: running, or stopped and its log still open */
    shown: !result || (failed && visible),
    ratio: done / Math.max(1, total)
  }
}

/** The creation, followed here: done, running, to come, the time and a bar */
export default function CreationProgress({ onBack }: { onBack?: () => void }) {
  const { t } = useI18n()
  const s = t.newProject.setup
  const p = useCreationProgress()
  const { projectId, openOnDone, minimized, visible, setMinimized } = useConsole()
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  const finished = p?.finished ?? true
  useEffect(() => {
    if (finished) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [finished])
  // The card shows up under the summary: brought into view
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [])
  if (!p) return null

  const { creation: c, at, done, ok, failed } = p
  const secs = Math.max(0, Math.round(((finished ? now : Date.now()) - c.startedAt) / 1000))
  const elapsed = secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} min ${String(secs % 60).padStart(2, '0')} s`

  return (
    <div ref={ref}>
      <Card role="status" aria-live="polite" className="flex flex-col gap-2.5 p-4 px-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <strong className="min-w-0 flex-1 text-fg">
            {ok ? s.progressDone : failed ? s.progressFailed.replace('{label}', c.planned[at] ?? '') : s.progress.replace('{at}', String(done)).replace('{n}', String(c.planned.length))}
          </strong>
          <span className="font-mono text-sm text-fg-muted">{elapsed}</span>
          {(minimized || !visible) && <Button variant="secondary" size="sm" onClick={() => setMinimized(false)}>{s.showLog}</Button>}
          {failed && onBack && <Button variant="secondary" size="sm" onClick={onBack}>{t.newProject.back}</Button>}
          {ok && projectId && !openOnDone && <Button size="sm" onClick={() => navigate(`/project/${projectId}`)}>{t.console.openProject}</Button>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-line">
          <div className={cn('h-full transition-[width] duration-500', failed ? 'bg-danger' : ok ? 'bg-success' : 'bg-accent')} style={{ width: `${Math.round(100 * p.ratio)}%` }} />
        </div>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm lg:grid-cols-4">
          {c.planned.map((label, i) => {
            const state = i < done ? 'done' : i === at && !ok ? (failed ? 'failed' : 'running') : 'todo'
            return (
              <li key={i} className={cn('flex min-w-0 items-center gap-1.5', state === 'done' ? 'text-success' : state === 'running' ? 'text-warning' : state === 'failed' ? 'text-danger' : 'text-fg-muted')}>
                {state === 'done' ? <Check size={13} className="shrink-0" /> : state === 'failed' ? <X size={13} className="shrink-0" /> : <span aria-hidden className="w-[13px] shrink-0 text-center">{state === 'running' ? '●' : '○'}</span>}
                <span className="truncate" title={label}>{label}</span>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
