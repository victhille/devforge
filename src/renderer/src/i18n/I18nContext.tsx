import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from 'react'
import translations, { type Lang, type Translations } from './translations'
import { applyAppearance } from '@renderer/lib/appearance'

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

  // The UI waits for the saved language (a few ms): nothing renders, toasts
  // included, in a language the user did not pick
  useEffect(() => {
    window.devforge.getSettings()
      .then(s => {
        setLang((s as { language?: Lang }).language ?? 'en')
        applyAppearance(s)
      })
      .catch(() => setLang('en'))
  }, [])

  const value = useMemo(() => lang && { lang, setLang, t: translations[lang] }, [lang])
  if (!value) return null

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  return useContext(I18nContext)
}
