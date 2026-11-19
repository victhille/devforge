import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

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

/** This PC's user folder, written as `~` in the log (it carries the Windows account name) */
const home = (() => {
  try {
    return homedir()
  } catch {
    return ''
  }
})()
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const HOME_RE = home ? new RegExp(`${escape(home).replace(/\\\\/g, '[\\\\/]')}(?=[\\\\/]|\\b|$)`, 'gi') : null

/**
 * Masks what looks like a secret or a personal detail before a line reaches the log (and the
 * diagnostic report, which copies its last lines): the AI providers' and GitHub's keys, bearer
 * tokens, passwords in URLs and in `key=value` or JSON, e-mail addresses, the user's folder.
 */
export function redact(text: string): string {
  let out = text
    // No word boundary before the prefixes: a key may follow a letter (api_key%3Dsk-ant-…)
    .replace(/(sk-(?:ant|proj|or|svcacct)-)[\w-]+/g, '$1***')
    .replace(/sk-[A-Za-z0-9]{20,}/g, 'sk-***')
    .replace(/(AIza|xai-|gsk_|github_pat_)[\w-]{16,}/g, '$1***')
    .replace(/(gh[pousr]_)[A-Za-z0-9]{20,}/g, '$1***')
    .replace(/(bearer\s+)[\w.-]+/gi, '$1***')
    .replace(/(\/\/[^:/\s]+:)[^@/\s]+@/g, '$1***@')
    // JSON: "password", "access_token", "client_secret", "X-N8N-API-KEY"…
    .replace(/("[\w-]*(?:password|passwd|pwd|passphrase|secret|token|api[_-]?key|apikey|authorization)"\s*:\s*)"[^"]*"/gi, '$1"***"')
    // key=value and key: value, the value quoted or not (password="x", { token: 'y' })
    .replace(/((?:password|passwd|pwd|passphrase|secret|token|api[_-]?key)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s"',}]+)/gi, '$1***')
    // E-mail addresses, but not the user part of an SSH remote (git@github.com:…)
    .replace(/(?<![\w.+-])(?!git@)[\w.+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, '***@***')
  if (HOME_RE) out = out.replace(HOME_RE, '~')
  // Another account's folder: C:\Users\someone (also escaped in JSON), /home/someone, /Users/someone.
  // One class for the separators, not \\\\|\\ (a run of backslashes would split in exponentially many ways)
  return out
    .replace(/\b([A-Za-z]:[\\/]+Users[\\/]+)(?!Public\b)[^\\/\s"']+/gi, '$1***')
    .replace(/(^|[\s"'(=])(\/(?:home|Users)\/)(?!Shared\b)[^/\s"']+/g, '$1$2***')
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
  try {
    rotate()
    appendFileSync(file(), line, 'utf-8')
  } catch {
    /* never let logging crash the app */
  }
}

/** The last lines of the log, newest last */
export function tailLog(lines = 200): string {
  if (!dir) return ''
  const parts: string[] = []
  for (let n = KEEP - 1; n >= 0; n--) if (existsSync(file(n))) parts.push(readFileSync(file(n), 'utf-8'))
  return parts.join('').split('\n').filter(Boolean).slice(-lines).join('\n')
}
