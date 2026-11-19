import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Minus, RotateCw } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useUpdateStatus } from '@renderer/features/settings/UpdatesRow'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import { setUpdateCardOpen, takeFocus, useUpdateCardOpen } from './updateCardState'

const MB = 1024 * 1024

/**
 * A new version, from its download to its install: a card at the bottom right (as Discord does), shrunk into
 * the title-bar pill on demand. « Restart and update » covers the window while DevForge closes, so the switch
 * to the installer never looks like a crash.
 */
export default function UpdateCard() {
  const { t } = useI18n()
  const s = t.settings
  const navigate = useNavigate()
  const status = useUpdateStatus()
  const open = useUpdateCardOpen()
  const [installing, setInstalling] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  // Opened again from the pill: the focus goes to the card, never when it appears by itself
  useEffect(() => {
    if (open && heading.current && takeFocus()) heading.current.focus()
  }, [open])
  const shrink = () => setUpdateCardOpen(false, true)

  if (status.state !== 'downloading' && status.state !== 'ready') return null
  const v = status.version

  if (installing)
    return (
      <div role="status" className="fixed inset-0 z-[60] grid place-items-center bg-chrome/85">
        <div className="flex max-w-sm flex-col items-center gap-3 px-6 text-center">
          <span aria-hidden className="grid size-14 animate-pulse place-items-center rounded-card bg-accent text-accent-fg">
            <RotateCw size={26} />
          </span>
          <p className="text-md font-semibold text-fg">{s.updateCardInstalling.replace('{v}', v)}</p>
          <p className="text-sm text-fg-secondary">{s.updateCardInstallingHint}</p>
        </div>
      </div>
    )
  if (!open) return null

  const downloading = status.state === 'downloading'
  const restart = () => {
    setInstalling(true)
    // The cover is painted first, then DevForge closes and the installer takes over
    setTimeout(() => window.devforge.updates.install(), 400)
  }
  const left =
    downloading && status.total && status.transferred !== undefined && status.bytesPerSecond
      ? (status.total - status.transferred) / status.bytesPerSecond
      : null

  return (
    <section
      aria-label={s.updateCardRegion}
      onKeyDown={e => {
        if (e.key === 'Escape') shrink()
      }}
      className="df-pop fixed right-5 bottom-5 z-50 flex w-[340px] max-w-[calc(100vw-40px)] flex-col gap-3 rounded-card border border-line bg-elevated p-4 shadow-pop"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-soft text-accent">
          {downloading ? <Download size={18} /> : <RotateCw size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          {/* Read out when it changes: « ready » is said, the percentages are not */}
          <div role="status">
            <h2 ref={heading} tabIndex={-1} className="text-md font-semibold text-fg outline-none">
              {(downloading ? s.updateCardDownloading : s.updateCardReady).replace('{v}', v)}
            </h2>
          </div>
          <p className="mt-0.5 text-sm text-fg-secondary">
            {downloading ? s.updateCardDownloadingHint.replace('{p}', String(status.percent)) : s.updateCardReadyHint}
          </p>
        </div>
        <IconButton size="sm" title={s.updateCardMinimize} onClick={shrink}>
          <Minus size={14} />
        </IconButton>
      </div>

      {downloading ? (
        <div className="flex flex-col gap-1.5">
          <div
            role="progressbar"
            aria-label={s.updateCardDownloading.replace('{v}', v)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={status.percent}
            className="h-1.5 overflow-hidden rounded-full bg-active"
          >
            <div className="df-fill h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${status.percent}%` }} />
          </div>
          {status.total ? (
            <div className="flex justify-between font-mono text-xs text-fg-muted">
              <span>
                {s.updateCardSize
                  .replace('{got}', String(Math.round((status.transferred ?? 0) / MB)))
                  .replace('{total}', String(Math.round(status.total / MB)))}
              </span>
              {left !== null && (
                <span>
                  {left < 90
                    ? s.updateCardSeconds.replace('{n}', String(Math.max(1, Math.round(left))))
                    : s.updateCardMinutes.replace('{n}', String(Math.round(left / 60)))}
                </span>
              )}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex gap-2">
            <Button className="flex-1" onClick={restart}>
              {s.updateRestart}
            </Button>
            <Button variant="secondary" onClick={shrink}>
              {s.updateCardLater}
            </Button>
          </div>
          <p className="text-xs text-fg-secondary">{s.updateCardLaterHint}</p>
          <button type="button" onClick={() => navigate('/settings?section=updates')} className="self-start text-sm text-accent hover:underline">
            {s.updateCardWhatsNew}
          </button>
        </div>
      )}
    </section>
  )
}
