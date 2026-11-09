import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import translations, { type Lang, type Translations } from './translations'
import { applyAppearance } from '@renderer/lib/appearance'
import { useSettings } from '@renderer/hooks/useLiveData'

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: Translations
}

const I18nContext = createContext<I18nContextValue>({
  lang:   'en',
  setLang: () => {},
  t:      translations.en
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang | null>(null)
  const { data: settings, error } = useSettings()

  // The UI waits for the saved language (a few ms): nothing renders, toasts included, in a language the user did not
  // pick. Then the language and appearance follow the settings, however they change (a page, another window, an import)
  useEffect(() => {
    if (!settings) return
    setLang((settings as { language?: Lang }).language ?? 'en')
    applyAppearance(settings)
  }, [settings])
  useEffect(() => { if (error) setLang(l => l ?? 'en') }, [error])

  const value = useMemo(() => lang && { lang, setLang, t: translations[lang] }, [lang])
  if (!value) return null

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
