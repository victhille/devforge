import { useEffect, useRef } from 'react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from './ToastContext'

/** One toast when a downloaded update is ready to install */
export default function UpdateNotice() {
  const { t } = useI18n()
  const toast = useToast()
  const shown = useRef<string | null>(null)

  useEffect(() => window.devforge.updates.onStatus(s => {
    if (s.state !== 'ready' || shown.current === s.version) return
    shown.current = s.version
    toast.show({
      tone: 'info',
      title: t.settings.updateReadyToast.replace('{v}', s.version),
      description: t.settings.updateReady.replace('{v}', s.version),
      action: { label: t.settings.updateRestart, onClick: () => window.devforge.updates.install() }
    })
  }), [t, toast])

  return null
}
