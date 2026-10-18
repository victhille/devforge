import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from './ToastContext'

const KEY = 'devforge:last-version'

/** After an update, one toast pointing to the release notes of the new version */
export default function WhatsNew() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    let previous: string | null = null
    try {
      previous = localStorage.getItem(KEY)
      localStorage.setItem(KEY, __APP_VERSION__)
    } catch { /* storage unavailable: no notice */ }
    if (!previous || previous === __APP_VERSION__) return
    toast.show({
      tone: 'info',
      title: t.settings.updatedTo.replace('{v}', __APP_VERSION__),
      description: t.settings.updatedFrom.replace('{v}', previous),
      action: { label: t.settings.seeWhatsNew, onClick: () => navigate(`/settings?notes=${__APP_VERSION__}`) }
    })
  // Once per launch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
