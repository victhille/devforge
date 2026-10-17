import en from './locales/en'
import fr from './locales/fr'

export type Lang = 'en' | 'fr'

const translations = { en, fr } as const

export type Translations = (typeof translations)[Lang]
export default translations
