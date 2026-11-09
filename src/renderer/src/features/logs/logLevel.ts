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

/**
 * A line's time and its message, when it starts with a timestamp: « [2026-11-06 22:41:09] local.ERROR: boom »
 * gives 22:41:09 and « boom » (the level has its own column). A line without one (JSON, a stack trace) stays whole.
 */
export function splitLine(text: string): { time: string | null; message: string } {
  const head = /^\s*\[?(?:\d{4}-\d{2}-\d{2}[T ])?(\d{2}:\d{2}:\d{2})(?:[.,]\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?\]?\s*/.exec(text)
  if (!head) return { time: null, message: text }
  // The level is in its own column: « local.ERROR: » (Monolog), « INFO » or « [WARN] » leave the message
  const rest = text.slice(head[0].length).replace(/^(?:[\w-]+\.)?\[?(?:EMERGENCY|ALERT|CRITICAL|FATAL|ERROR|WARNING|WARN|NOTICE|INFO|DEBUG|TRACE)\]?:?\s+/i, '')
  return { time: head[1], message: rest }
}

/** The level's tag in the time column, as loggers write it */
export const LEVEL_TAG: Record<LogLevel, string> = { error: 'ERROR', warn: 'WARNING', info: 'INFO', debug: 'DEBUG', other: '' }
