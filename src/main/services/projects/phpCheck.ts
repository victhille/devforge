import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs'
import type { PhpStatus, SetupDatabase } from '@shared/types'
import { runFile } from '../../lib/exec'

/** What Composer and a Symfony web app need, plus the driver of the chosen database */
export function requiredExtensions(database: SetupDatabase): string[] {
  const base = ['openssl', 'curl', 'mbstring', 'intl', 'zip', 'fileinfo']
  const driver = { postgres: ['pdo_pgsql'], mysql: ['pdo_mysql'], sqlite: ['pdo_sqlite'], none: [] }[database]
  return [...base, ...driver]
}

const EXT_RE = /^[a-z0-9_]+$/

/** Uncomments `;extension=x` lines, adds the missing ones; the rest of php.ini stays as is */
export function enableExtensions(ini: string, exts: string[]): string {
  const eol = ini.includes('\r\n') ? '\r\n' : '\n'
  let text = ini
  const added: string[] = []
  for (const ext of exts) {
    if (!EXT_RE.test(ext)) continue
    // [ \t] and not \s: \s would run over the line breaks of a CRLF file
    const value = `[ \\t]*=[ \\t]*"?(php_)?${ext}(\\.dll)?"?[ \\t]*(?=\\r?$)`
    const active = new RegExp(`^[ \\t]*extension${value}`, 'm')
    if (active.test(text)) continue
    const commented = new RegExp(`^[ \\t]*;[ \\t]*extension${value}`, 'm')
    if (commented.test(text)) text = text.replace(commented, `extension=${ext}`)
    else added.push(`extension=${ext}`)
  }
  if (!added.length) return text
  return text + (text.endsWith(eol) ? '' : eol) + `; Added by DevForge${eol}` + added.join(eol) + eol
}

export async function phpStatus(database: SetupDatabase): Promise<PhpStatus> {
  const r = await runFile('php', ['-r', 'echo php_ini_loaded_file(), "\\n", implode(",", get_loaded_extensions());'], { timeout: 15_000 })
  if (!r.ok) return { found: false, ini: null, missing: [] }
  const [ini, list = ''] = r.stdout.trim().split(/\r?\n/)
  const loaded = new Set(list.split(',').map(e => e.trim().toLowerCase()))
  return { found: true, ini: ini && ini !== '' ? ini : null, missing: requiredExtensions(database).filter(e => !loaded.has(e)) }
}

/** Enables the missing extensions in the loaded php.ini; a copy is kept once as php.ini.devforge-bak */
export async function phpEnable(database: SetupDatabase): Promise<PhpStatus> {
  const before = await phpStatus(database)
  if (!before.ini || !existsSync(before.ini)) throw new Error('NO_INI')
  if (!before.missing.length) return before
  const backup = `${before.ini}.devforge-bak`
  if (!existsSync(backup)) copyFileSync(before.ini, backup)
  writeFileSync(before.ini, enableExtensions(readFileSync(before.ini, 'utf-8'), before.missing))
  return phpStatus(database)
}
