/** VPS stats: commands and parsers are shared with the main process (background watch) */
export * from '@shared/lib/vpsStats'

// ─── Format helpers ───────────────────────────────────────────────────────────

export function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(0) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

export function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60)
  if (d > 0) return `${d}j ${h}h ${m}m`
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
