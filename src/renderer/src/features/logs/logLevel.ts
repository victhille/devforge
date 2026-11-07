export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'other'

const PINO_LEVELS: Record<number, LogLevel> = { 10: 'debug', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'error' }

/** Guess the level of a log line: JSON loggers (pino, winston, bunyan) or plain text. */
export function levelOf(line: string): LogLevel {
  const trimmed = line.trimStart()
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as { level?: string | number; severity?: string }
      const lvl = obj.level ?? obj.severity
      if (typeof lvl === 'number') return PINO_LEVELS[lvl] ?? 'other'
      if (typeof lvl === 'string') return levelOf(lvl)
    } catch { /* not JSON, fall through */ }
  }
  if (/\b(fatal|crit(ical)?|emerg(ency)?|error|err|exception|panic)\b|\bE\/|Traceback|Uncaught/i.test(line)) return 'error'
  if (/\b(warn(ing)?|deprecated)\b/i.test(line)) return 'warn'
  if (/\b(info|notice|log)\b/i.test(line)) return 'info'
  if (/\b(debug|trace|verbose)\b/i.test(line)) return 'debug'
  return 'other'
}

export const LEVEL_COLOR: Record<LogLevel, string> = {
  error: 'text-danger',
  warn:  'text-warning',
  info:  'text-fg',
  debug: 'text-fg-muted',
  other: 'text-fg-secondary'
}
