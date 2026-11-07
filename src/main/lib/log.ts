import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'

/**
 * Local error log: userData/logs/devforge.log, rotated at 1 MB (3 files kept).
 * Nothing is sent anywhere; Settings can copy a report for a bug ticket.
 */
const MAX_BYTES = 1_000_000
const KEEP = 3

let dir: string | null = null

export function initLog(logDir: string): void {
  dir = logDir
  mkdirSync(dir, { recursive: true })
}

const file = (n = 0) => join(dir!, n === 0 ? 'devforge.log' : `devforge.${n}.log`)

/** Masks what looks like a secret: API keys, bearer tokens, passwords in URLs */
export function redact(text: string): string {
  return text
    .replace(/sk-ant-[\w-]+/g, 'sk-ant-***')
    .replace(/(bearer\s+)[\w.-]+/gi, '$1***')
    .replace(/(\/\/[^:/\s]+:)[^@/\s]+@/g, '$1***@')
    .replace(/((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*)\S+/gi, '$1***')
}

function rotate(): void {
  if (!existsSync(file()) || statSync(file()).size < MAX_BYTES) return
  for (let n = KEEP - 1; n >= 1; n--) if (existsSync(file(n - 1))) renameSync(file(n - 1), file(n))
}

export function log(level: 'info' | 'warn' | 'error', scope: string, message: unknown): void {
  const text = message instanceof Error ? `${message.message}\n${message.stack ?? ''}` : String(message)
  const line = `${new Date().toISOString()} ${level.toUpperCase()} [${scope}] ${redact(text)}\n`
  if (level === 'error') console.error(line.trimEnd())
  if (!dir) return
  try { rotate(); appendFileSync(file(), line, 'utf-8') } catch { /* never let logging crash the app */ }
}

/** The last lines of the log, newest last */
export function tailLog(lines = 200): string {
  if (!dir) return ''
  const parts: string[] = []
  for (let n = KEEP - 1; n >= 0; n--) if (existsSync(file(n))) parts.push(readFileSync(file(n), 'utf-8'))
  return parts.join('').split('\n').filter(Boolean).slice(-lines).join('\n')
}
