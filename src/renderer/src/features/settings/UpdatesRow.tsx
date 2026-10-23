import { useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, RotateCcw, Sparkles } from 'lucide-react'
import type { AppSettings, UpdateStatus } from '@shared/types'
import { parseChangelog } from '@shared/lib/changelog'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Badge from '@renderer/components/ui/Badge'
import Switch from '@renderer/components/ui/Switch'
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

/** Settings → Updates: version, status, channel, release notes and "What's new" */
export default function UpdatesSettings({ settings, set, onNotes }: {
  settings: AppSettings; set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => void; onNotes: () => void
}) {
  const { t, lang } = useI18n()
  const u = t.settings
  const status = useUpdateStatus()
  const [checking, setChecking] = useState(false)
  const current = useMemo(() => parseChangelog(__CHANGELOGS__[lang] || __CHANGELOGS__.fr).find(v => v.version === __APP_VERSION__), [lang])

  const text = status.state === 'checking' ? u.updateChecking
    : status.state === 'up-to-date' ? u.updateUpToDate
    : status.state === 'downloading' ? u.updateDownloading.replace('{v}', status.version).replace('{p}', String(status.percent))
    : status.state === 'ready' ? u.updateReady.replace('{v}', status.version)
    : status.state === 'unavailable' ? (status.reason === 'dev' ? u.updateDev : status.reason === 'auth' ? u.updateAuth : u.updateFeed)
    : ''

  return (
    <SettingsCard title={u.nav.updates}>
      <div className="flex flex-wrap items-center gap-4 border-t border-line-subtle px-5 py-5">
        <div aria-hidden className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-accent-soft">
          <svg width="26" height="26" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="6" className="fill-accent" /><path d="M7 15h10 M9 15V9h6l2 3h-8" className="stroke-canvas" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="min-w-[200px] flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-fg">DevForge {__APP_VERSION__}</h3>
            {status.state === 'up-to-date' && <Badge color="success">{u.updateUpToDate}</Badge>}
            {__APP_VERSION__.includes('-') && <Badge color="warning">{u.channelPre}</Badge>}
          </div>
          {text && <div className="mt-1 text-[12.5px] text-fg-secondary">{text}</div>}
        </div>
        {status.state === 'ready' ? (
          <Button onClick={() => window.devforge.updates.install()}><RotateCcw size={14} /> {u.updateRestart}</Button>
        ) : (
          <Button variant="secondary" loading={checking} disabled={status.state === 'downloading'}
            onClick={async () => { setChecking(true); try { await window.devforge.updates.check() } finally { setChecking(false) } }}>
            {!checking && (status.state === 'downloading' ? <Download size={14} /> : <RefreshCw size={14} />)} {u.updateCheck}
          </Button>
        )}
      </div>
      <button type="button" onClick={onNotes}
        className="mx-5 mb-[18px] flex w-[calc(100%-40px)] items-center gap-3.5 rounded-xl border border-accent/40 bg-accent-soft/60 px-4 py-3.5 text-left transition-colors hover:bg-accent-soft">
        <Sparkles size={18} className="shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-fg">{u.notesOf.replace('{v}', __APP_VERSION__)}</span>
          {current?.summary && <span className="mt-0.5 block truncate text-[12.5px] text-fg-secondary">{current.summary}</span>}
        </span>
        <span className="shrink-0 text-[12.5px] text-accent">{u.seeAllVersions}</span>
      </button>
      <SettingRow label={u.channel} hint={u.channelHint}>
        <Segmented<'stable' | 'beta'> label={u.channel} value={settings.updateChannel ?? 'stable'} onChange={c => set('updateChannel', c)}
          items={[{ value: 'stable', label: u.channelStable }, { value: 'beta', label: u.channelBeta }]} />
      </SettingRow>
      <SettingRow label={u.showWhatsNew} hint={u.showWhatsNewHint}>
        <Switch checked={settings.showWhatsNew !== false} onChange={v => set('showWhatsNew', v)} label={u.showWhatsNew} />
      </SettingRow>
    </SettingsCard>
  )
}
