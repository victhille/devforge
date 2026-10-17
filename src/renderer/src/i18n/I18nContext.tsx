import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import translations, { type Lang, type Translations } from './translations'
import type { Theme } from '@shared/types'

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
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    window.devforge.getSettings().then(s => {
      const l  = (s as { language?: Lang }).language ?? 'en'
      const th = (s as { theme?: Theme }).theme ?? 'dark'
      setLangState(l)
      document.documentElement.setAttribute('data-theme', th)
    })
  }, [])

  function setLang(l: Lang) {
    setLangState(l)
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}
