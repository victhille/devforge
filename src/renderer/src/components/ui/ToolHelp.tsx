import { useState } from 'react'
import { CircleHelp, Lightbulb, X } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import IconButton from './IconButton'

const KEY = 'tool-help-hidden'

function hidden(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]) } catch { return new Set() }
}

/**
 * v3.5 lot 4: the line at the top of a tool, for whoever does not know it:
 * what it is for, how to use it, and examples to load (an example only fills
 * the fields: nothing is saved or sent). Can be hidden, per tool.
 */
export default function ToolHelp({ id, what, how, examples }: {
  id: string
  what: string
  how: string
  examples?: { label: string; onPick: () => void }[]
}) {
  const { t } = useI18n()
  const h = t.toolHelp
  const [closed, setClosed] = useState(() => hidden().has(id))
  function toggle(next: boolean) {
    const all = hidden()
    if (next) all.add(id)
    else all.delete(id)
    try { localStorage.setItem(KEY, JSON.stringify([...all])) } catch { /* ignore */ }
    setClosed(next)
  }

  if (closed) {
    return (
      <button onClick={() => toggle(false)} className="flex shrink-0 items-center gap-1.5 self-start text-xs font-medium text-fg-muted hover:text-accent">
        <CircleHelp size={13} /> {h.show}
      </button>
    )
  }
  return (
    <aside aria-label={h.label} className="flex shrink-0 items-start gap-3 rounded-[12px] border border-line bg-surface px-4 py-3">
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-[13px] leading-relaxed">
        <p className="text-fg">{what}</p>
        <p className="text-fg-secondary">{how}</p>
        {!!examples?.length && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-xs text-fg-muted">{h.examples}</span>
            {examples.map(e => (
              <button key={e.label} onClick={e.onPick}
                className="rounded-full border border-line bg-elevated px-2.5 py-0.5 text-xs font-medium text-fg-secondary hover:border-accent/50 hover:text-fg">
                {e.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <IconButton size="sm" title={h.hide} onClick={() => toggle(true)}><X size={13} /></IconButton>
    </aside>
  )
}
