import { useEffect, useState } from 'react'
import { Download, RotateCw } from 'lucide-react'
import type { UpdateStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

/**
 * Title-bar button, next to Forgy, shown only when a new version is on its
 * way: the download progress, then "Restart to update". The update installs
 * in place (electron-updater), no reinstall.
 */
export default function UpdateButton() {
  const { t } = useI18n()
  const s = t.settings
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    window.devforge.updates.status().then(setStatus).catch(() => {})
    return window.devforge.updates.onStatus(setStatus)
  }, [])

  if (status.state !== 'downloading' && status.state !== 'ready') return null
  const ready = status.state === 'ready'
  const label = ready ? s.updateRestart : s.updateDownloading.replace('{v}', status.version).replace('{p}', String(status.percent))

  return (
    <button
      onClick={() => { if (ready) window.devforge.updates.install() }}
      disabled={!ready}
      title={ready ? `${s.updateRestart} (v${status.version})` : label}
      aria-label={label}
      className={cn(
        'app-no-drag relative flex h-[30px] shrink-0 items-center gap-1.5 overflow-hidden rounded-full border px-3 text-sm font-medium transition-colors',
        ready ? 'border-accent/50 bg-accent-soft text-accent hover:border-accent' : 'cursor-default border-line bg-canvas text-fg-secondary'
      )}
    >
      {/* Download progress fills the pill */}
      {!ready && <span aria-hidden className="absolute inset-y-0 left-0 bg-accent-soft transition-[width] duration-500" style={{ width: `${status.percent}%` }} />}
      <span className="relative flex items-center gap-1.5">
        {ready ? <RotateCw size={14} /> : <Download size={14} />}
        {ready ? t.nav.update.replace('{v}', status.version) : `v${status.version} · ${status.percent} %`}
      </span>
    </button>
  )
}
