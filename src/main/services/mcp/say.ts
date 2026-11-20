import { loadSettings } from '../settings/settingsService'

/** A message the window shows, in the language the user chose (French when it cannot be read) */
export function say(fr: string, en: string): string {
  try {
    return loadSettings().language === 'en' ? en : fr
  } catch {
    return fr
  }
}
