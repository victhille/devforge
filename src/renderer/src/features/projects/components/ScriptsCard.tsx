import { useEffect, useState, type ReactNode } from 'react'
import { Play, Square } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import StatusDot from '@renderer/components/ui/StatusDot'
import Kbd from '@renderer/components/ui/Kbd'

/** How long a script has run: 42 s, 12 min, 2 h 04 */
export function runFor(since: number, now: number): string {
  const s = Math.max(0, Math.floor((now - since) / 1000))
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

/** The time, again every 20 seconds while a script runs */
export function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
  }, [active])
  return now
}

/**
 * The project's scripts (package.json), as in the mock-up: each runs in a tab of
 * the project's terminal; one that runs has a live dot, its time (and the port the
 * project listens on), and stops from here. `title` and `extra` let the overview
 * reuse the list in its own card.
 */
export function ScriptList({ scripts, runs, port, onRun, onStop }: {
  scripts: [string, string][]
  runs: Record<string, number | null>
  /** The port the project listens on, shown beside a script that runs */
  port?: number | null
  onRun: (name: string) => void
  onStop: (name: string) => void
}) {
  const { t } = useI18n()
  const h = t.hub
  const now = useNow(Object.values(runs).some(v => v != null))
  if (!scripts.length) return <p className="text-sm text-fg-muted">{h.scriptsNone}</p>
  return (
    <ul className="flex flex-col">
      {scripts.map(([name, cmd]) => {
        const since = runs[name] ?? null
        return (
          <li key={name} className="flex min-h-9.5 min-w-0 items-center gap-2.5 border-b border-line-subtle last:border-b-0">
            {since != null ? <StatusDot state="on" live /> : <span aria-hidden className="size-2 shrink-0" />}
            <span className="shrink-0 font-mono text-sm text-fg">{name}</span>
            <span className={cn('min-w-0 flex-1 truncate font-mono text-xs', since != null ? 'text-success' : 'text-fg-muted')} title={cmd}>
              {since != null ? [port ? `:${port}` : null, h.scriptRunning, runFor(since, now)].filter(Boolean).join(' · ') : cmd}
            </span>
            {since != null
              ? <IconButton size="sm" title={h.scriptStop.replace('{name}', name)} onClick={() => onStop(name)}><Square size={12} /></IconButton>
              : <IconButton size="sm" title={h.scriptRun.replace('{name}', name)} onClick={() => onRun(name)}><Play size={13} /></IconButton>}
          </li>
        )
      })}
    </ul>
  )
}

/** The keys of the project's terminal */
function Shortcuts() {
  const { t } = useI18n()
  const h = t.hub
  const keys: [ReactNode, string][] = [
    [<><Kbd>→</Kbd> <Kbd>{h.keyEnd}</Kbd></>, h.shortcutAccept],
    [<Kbd>↑</Kbd>, h.shortcutPrev],
    [<Kbd>Ctrl R</Kbd>, h.shortcutSearch],
    [<Kbd>Ctrl L</Kbd>, h.shortcutClear],
    [<Kbd>Ctrl `</Kbd>, h.shortcutDock]
  ]
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4.5 gap-y-2 text-sm">
      {keys.map(([k, what]) => (
        <div key={what} className="contents">
          <dt className="flex gap-1">{k}</dt>
          <dd className="text-fg-secondary">{what}</dd>
        </div>
      ))}
    </dl>
  )
}

/** The terminal's side: the scripts, then the keys */
export default function ScriptsCard(props: Parameters<typeof ScriptList>[0] & { className?: string }) {
  const { t } = useI18n()
  const h = t.hub
  return (
    <Card className={cn('flex min-w-0 flex-col gap-3 self-start p-4.5', props.className)}>
      <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{h.scriptsTitle}</h2>
      <ScriptList {...props} />
      <h2 className="mt-2 font-display text-md font-bold tracking-[-.01em] text-fg">{h.shortcutsTitle}</h2>
      <Shortcuts />
    </Card>
  )
}
