/** VPS stats: commands and parsers are shared with the main process (background watch) */
import { formatDuration, type DurationUnit } from '@renderer/lib/format'
import type { Lang } from '@renderer/i18n/translations'

export * from '@shared/lib/vpsStats'

// ─── Format helpers ───────────────────────────────────────────────────────────

/** `day` is the short day unit of the interface language (j / d) */
export function fmtUptime(sec: number, day = 'd'): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}${day} ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Text color class for a usage percentage. */
export function usageTone(pct: number): string {
  if (pct < 60) return 'text-success'
  if (pct < 80) return 'text-warning'
  return 'text-danger'
}

/** Background color class for a usage bar. */
export function usageBar(pct: number): string {
  if (pct < 60) return 'bg-success'
  if (pct < 80) return 'bg-warning'
  return 'bg-danger'
}

export function dockerTone(status: string): string {
  const s = status.toLowerCase()
  if (s.startsWith('up')) return 'bg-success'
  if (s.includes('exit')) return 'bg-danger'
  return 'bg-warning'
}

/**
 * How long a container has been in its state, short and in the UI language:
 * Docker's "Up 23 days (healthy)" → "23 j", "Exited (0) 2 hours ago" → "2 h".
 * Null when the status carries no duration ("Created", "Dead").
 */
export function dockerSince(status: string, lang: Lang): string | null {
  const m = /\b(?:(less than a second)|about an? (minute|hour)|(\d+) (second|minute|hour|day|week|month|year)s?)\b/i.exec(status)
  if (!m) return null
  if (m[1]) return `< ${formatDuration(1, 'second', lang)}`
  const unit = (m[2] ?? m[4]).toLowerCase() as DurationUnit
  return formatDuration(m[3] ? Number(m[3]) : 1, unit, lang)
}
