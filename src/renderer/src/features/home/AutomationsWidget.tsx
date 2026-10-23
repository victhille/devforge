import { useEffect, useState } from 'react'
import type { AutomationsFeed } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatRelative } from '@renderer/lib/format'
import Spinner from '@renderer/components/ui/Spinner'
import { Pill, SmallButton, Tile } from './parts'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
/** Automations refreshes its cache about every minute */
const REFRESH_MS = 60_000

/** What each n8n automation published last, read from Automations's cache on this PC */
export default function AutomationsWidget({ i }: { i: number }) {
  const { t, lang } = useI18n()
  const w = t.home.widgets
  const toast = useToast()
  const [feed, setFeed] = useState<AutomationsFeed | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = () => window.devforge.automations.feed().then(f => { setFeed(f); setError('') }).catch(e => setError(errorText(e)))
    load()
    const id = setInterval(() => { if (document.visibilityState === 'visible') load() }, REFRESH_MS)
    return () => clearInterval(id)
  }, [])

  const unread = feed?.automations.reduce((n, a) => n + a.unread, 0) ?? 0
  const urgent = feed?.unread.some(x => x.gravite === 'urgent')
  const open = async () => {
    try { await window.devforge.automations.open() } catch (e) { toast.show({ tone: 'error', title: errorText(e) === 'AUTOMATIONS_MISSING' ? w.automationsMissing : errorText(e) }) }
  }

  return (
    <Tile i={i} title={w.names.automations} aside={feed?.found && <Pill tone={unread ? (urgent ? 'warning' : 'accent') : 'success'}>{unread ? w.automationsUnread.replace('{n}', String(unread)) : w.automationsAllRead}</Pill>}>
      {error ? <p className="text-sm text-danger">{error}</p> : !feed ? <Spinner /> : !feed.found ? (
        <p className="text-sm text-fg-muted">{feed.installed ? w.automationsNoData : w.automationsMissing}</p>
      ) : (
        <div className="flex flex-col gap-2 text-base">
          {feed.automations.filter(a => a.last || a.unread).map(a => (
            <div key={a.key} className="flex items-center gap-2.5">
              <span className={a.unread ? 'size-2 shrink-0 rounded-full bg-accent' : 'size-2 shrink-0 rounded-full bg-fg-disabled'} />
              <span className="flex-1 truncate text-fg">{(w.automations as Record<string, string>)[a.key] ?? a.key}</span>
              {a.unread > 0 && <span className="font-mono text-xs text-accent">{a.unread}</span>}
              <span className="font-mono text-xs text-fg-muted">{a.last ? formatRelative(a.last.date, lang) : '—'}</span>
            </div>
          ))}
        </div>
      )}
      <SmallButton className="mt-auto" disabled={!feed?.installed} onClick={open}>{w.automationsOpen}</SmallButton>
    </Tile>
  )
}
