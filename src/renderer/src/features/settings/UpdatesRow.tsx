import { useEffect, useState } from 'react'
import { Download, RefreshCw, RotateCcw } from 'lucide-react'
import type { UpdateStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Tabs from '@renderer/components/ui/Tabs'

/** Live update status from the main process */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>({ state: 'idle' })
  useEffect(() => {
    window.devforge.updates.status().then(setStatus).catch(() => {})
    return window.devforge.updates.onStatus(setStatus)
  }, [])
  return status
}

/** Settings → About: channel, status, manual check, restart to update */
export default function UpdatesRow({ channel, onChannel }: { channel: 'stable' | 'beta'; onChannel: (c: 'stable' | 'beta') => void }) {
  const { t } = useI18n()
  const u = t.settings
  const status = useUpdateStatus()
  const [checking, setChecking] = useState(false)

  const text = status.state === 'checking' ? u.updateChecking
    : status.state === 'up-to-date' ? u.updateUpToDate
    : status.state === 'downloading' ? u.updateDownloading.replace('{v}', status.version).replace('{p}', String(status.percent))
    : status.state === 'ready' ? u.updateReady.replace('{v}', status.version)
    : status.state === 'unavailable' ? (status.reason === 'dev' ? u.updateDev : u.updateFeed)
    : ''

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-3">
        <Tabs<'stable' | 'beta'> value={channel} onChange={onChannel}
          items={[{ value: 'stable', label: u.channelStable }, { value: 'beta', label: u.channelBeta }]} />
        {status.state === 'ready' ? (
          <Button size="sm" onClick={() => window.devforge.updates.install()}><RotateCcw size={13} /> {u.updateRestart}</Button>
        ) : (
          <Button size="sm" variant="secondary" loading={checking} disabled={status.state === 'downloading'}
            onClick={async () => { setChecking(true); try { await window.devforge.updates.check() } finally { setChecking(false) } }}>
            {!checking && (status.state === 'downloading' ? <Download size={13} /> : <RefreshCw size={13} />)} {u.updateCheck}
          </Button>
        )}
        {text && <span className="text-sm text-fg-secondary">{text}</span>}
      </div>
      <span className="text-xs text-fg-muted">{u.updateHint}</span>
    </div>
  )
}
