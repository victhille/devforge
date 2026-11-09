import translations, { type Lang } from '@renderer/i18n/translations'

const decimals = new Map<string, Intl.NumberFormat>()

/** `n` with exactly `digits` decimals, in the UI language: 2.5 / 2,5 */
function decimal(n: number, digits: number, lang: Lang): string {
  const key = `${lang}:${digits}`
  let f = decimals.get(key)
  if (!f) decimals.set(key, f = new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }))
  return f.format(n)
}

/** A size in the UI language: "5.0 MB" / "5,0 Mo" */
export function formatSize(bytes: number | null | undefined, lang: Lang): string {
  if (bytes == null) return '—'
  const u = translations[lang].units
  if (bytes < 1024) return `${bytes} ${u.b}`
  if (bytes < 1024 ** 2) return `${decimal(bytes / 1024, 1, lang)} ${u.kb}`
  if (bytes < 1024 ** 3) return `${decimal(bytes / 1024 ** 2, 1, lang)} ${u.mb}`
  return `${decimal(bytes / 1024 ** 3, 2, lang)} ${u.gb}`
}

export type DurationUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

/** A short duration in the UI language: "23 d" / "23 j" */
export function formatDuration(n: number, unit: DurationUnit, lang: Lang): string {
  return `${n} ${translations[lang].units[unit]}`
}

/** A date in the UI language (without one, the language DevForge started in) */
export function formatDate(iso: string | null | undefined, lang?: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium' }).format(new Date(iso))
}

/** "3 min ago" / "il y a 3 min", in the UI language. */
export function formatRelative(iso: string | null | undefined, lang: string): string {
  if (!iso) return '—'
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]
  ]
  for (const [unit, secs] of units) {
    if (Math.abs(seconds) >= secs) return rtf.format(Math.round(seconds / secs), unit)
  }
  return rtf.format(Math.round(seconds), 'second')
}
