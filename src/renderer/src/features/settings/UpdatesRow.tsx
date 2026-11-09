import { useEffect, useMemo, useState } from 'react'
import { Check, Download, RefreshCw, RotateCcw } from 'lucide-react'
import type { AppSettings, UpdateStatus } from '@shared/types'
import type { ChangeType } from '@shared/lib/changelog'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Badge, { type BadgeColor } from '@renderer/components/ui/Badge'
import Card from '@renderer/components/ui/Card'
import Switch from '@renderer/components/ui/Switch'
import { WhatsNewDialog } from '@renderer/app/WhatsNew'
import { CHANGE_META, Inline, changelog } from './ReleaseNotes'
import { Segmented, SettingRow, SettingsCard } from './parts'

/** Live update status from the main process */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  useEffect(() => {
    window.devforge.updates.status().then(setStatus).catch(() => {})
    return window.devforge.updates.onStatus(setStatus)
  }, [])
  return status
}

/** A kind of change as a tag: new in the accent, improved in blue, fixed in grey */
const KIND_BADGE: Record<ChangeType, BadgeColor> = { new: 'accent', better: 'info', fix: 'default', other: 'default' }
type Filter = 'all' | 'new' | 'better' | 'fix'

/** Settings → Updates: the installed version and its channel, then what it brings */
export default function UpdatesSettings({ settings, set, onNotes }: {
  settings: AppSettings; set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void; onNotes: () => void
}) {
  const { t, lang } = useI18n()
  const u = t.settings
  const n = u.notes
  const status = useUpdateStatus()
  const [checking, setChecking] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [tour, setTour] = useState(false)
  const current = useMemo(() => changelog(lang).find(v => v.version === __APP_VERSION__), [lang])
  const items = current?.items.filter(it => filter === 'all' || it.type === filter) ?? []

  const text = status.state === 'checking' ? u.updateChecking
    : status.state === 'downloading' ? u.updateDownloading.replace('{v}', status.version).replace('{p}', String(status.percent))
    : status.state === 'ready' ? u.updateReady.replace('{v}', status.version)
    : status.state === 'unavailable' ? (status.reason === 'dev' ? u.updateDev : status.reason === 'auth' ? u.updateAuth : u.updateFeed)
    : ''
  const built = new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(__BUILD_DATE__))
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: n.all }, { id: 'new', label: n.filterNew }, { id: 'better', label: n.filterBetter }, { id: 'fix', label: n.filterFix }
  ]

  return (
    <>
      <Card className="df-rise overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-5">
          <div className="min-w-[220px] flex-1">
            <p className="text-sm text-fg-muted">{u.installedVersion}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-page font-bold tracking-[-.02em] text-fg">DevForge {__APP_VERSION__}</h2>
              {__APP_VERSION__.includes('-') && <Badge color="warning">{u.channelPre}</Badge>}
            </div>
            <p className="mt-1.5 font-mono text-xs text-fg-secondary">{u.builtLine.replace('{date}', built).replace('{commit}', __APP_COMMIT__)}</p>
            {text && <p role="status" className="mt-1.5 text-sm text-fg-secondary">{text}</p>}
          </div>
          {status.state === 'up-to-date' && <Badge color="success"><Check size={12} aria-hidden /> {u.updateUpToDate}</Badge>}
          {status.state === 'ready' ? (
            <Button onClick={() => window.devforge.updates.install()}><RotateCcw size={14} /> {u.updateRestart}</Button>
          ) : (
            <Button variant="secondary" loading={checking} disabled={status.state === 'downloading'}
              onClick={async () => { setChecking(true); try { await window.devforge.updates.check() } finally { setChecking(false) } }}>
              {!checking && (status.state === 'downloading' ? <Download size={14} /> : <RefreshCw size={14} />)} {u.updateCheck}
            </Button>
          )}
        </div>
        <SettingRow label={u.channel} hint={u.channelHint}>
          <Segmented<'stable' | 'beta'> label={u.channel} value={settings.updateChannel ?? 'stable'} onChange={c => set('updateChannel', c)}
            items={[{ value: 'stable', label: u.channelStable }, { value: 'beta', label: u.channelBeta }]} />
        </SettingRow>
        <SettingRow label={u.showWhatsNew} hint={u.showWhatsNewHint}>
          <div className="flex items-center gap-3">
            {!!current?.items.length && <Button size="sm" variant="ghost" onClick={() => setTour(true)}>{u.seeAgain}</Button>}
            <Switch checked={settings.showWhatsNew !== false} onChange={v => set('showWhatsNew', v)} label={u.showWhatsNew} />
          </div>
        </SettingRow>
      </Card>

      <SettingsCard title={u.notesOf.replace('{v}', __APP_VERSION__)} action={!!current?.items.length && (
        <div role="radiogroup" aria-label={u.notesOf.replace('{v}', __APP_VERSION__)} className="flex flex-wrap gap-1.5">
          {filters.map(f => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} onClick={() => setFilter(f.id)}
              className={cn('h-[30px] rounded-full border px-3 text-sm font-medium transition-colors',
                filter === f.id ? 'border-accent/50 bg-accent-soft text-accent' : 'border-line text-fg-secondary hover:bg-hover hover:text-fg')}>
              {f.label}
            </button>
          ))}
        </div>
      )}>
        {current?.summary && !items.length && <p className="border-t border-line-subtle px-5 py-3.5 text-sm text-fg-secondary">{current.summary}</p>}
        <ul>
          {items.map((it, i) => (
            <li key={i} className="grid grid-cols-[minmax(0,120px)_1fr] items-start gap-4 border-t border-line-subtle px-5 py-3">
              <span><Badge color={KIND_BADGE[it.type]}>{CHANGE_META[it.type].label(n)}</Badge></span>
              <p className="min-w-0 text-base leading-normal text-fg-secondary">
                {it.scope && <b className="font-semibold text-fg">{it.scope} · </b>}<Inline text={it.text} />
              </p>
            </li>
          ))}
        </ul>
        {!!current?.items.length && !items.length && <p className="border-t border-line-subtle px-5 py-3 text-sm text-fg-muted">{n.noneOfType}</p>}
        <div className="border-t border-line-subtle px-5 py-3">
          <Button size="sm" variant="ghost" className="text-accent" onClick={onNotes}>{u.seeAllVersions}</Button>
        </div>
      </SettingsCard>

      {tour && current && <WhatsNewDialog version={current} onClose={() => setTour(false)} onAllNotes={() => { setTour(false); onNotes() }} />}
    </>
  )
}
