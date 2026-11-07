import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { app, safeStorage } from 'electron'
import type { EnvBackupInfo, EnvFile, EnvProject } from '@shared/types'
import { getProjectPaths } from '../projects/projectStorage'

/** .env, .env.local, .env.example, .env.production.local … nothing else. */
const ENV_NAME = /^\.env(\.[A-Za-z0-9_-]+)*$/
const KEY_LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/

/** Only projects saved in DevForge can be read or written. */
function assertProject(projectPath: string): void {
  if (!getProjectPaths().has(projectPath)) throw new Error('Unknown project')
}

function assertName(name: string): void {
  if (!ENV_NAME.test(name)) throw new Error(`Not an env file: ${name}`)
}

function unquote(raw: string): string {
  const v = raw.trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    const inner = v.slice(1, -1)
    // Like dotenv: only \n (and \") are escapes in double quotes, other backslashes are literal
    return v.startsWith('"') ? inner.replace(/\\(n|")/g, (_, c: string) => (c === 'n' ? '\n' : '"')) : inner
  }
  // Strip trailing inline comment on unquoted values
  return v.replace(/\s+#.*$/, '')
}

/**
 * Value as dotenv reads it back unchanged. Single quotes are literal (Windows
 * paths, $VARS); double quotes only when a newline or an apostrophe needs them.
 */
function quoteIfNeeded(value: string): string {
  if (value === '' || /^[^\s#"'\\]*$/.test(value)) return value
  if (!value.includes("'") && !value.includes('\n')) return `'${value}'`
  return `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

export function parseEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const line of content.split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue
    const m = line.match(KEY_LINE)
    if (m) values[m[1]] = unquote(m[2])
  }
  return values
}

export async function readEnvProject(projectPath: string): Promise<EnvProject> {
  assertProject(projectPath)
  let names: string[] = []
  try {
    names = (await readdir(projectPath, { withFileTypes: true }))
      .filter(e => e.isFile() && ENV_NAME.test(e.name))
      .map(e => e.name)
  } catch { /* unreadable project */ }

  // .env first, examples last
  const rank = (n: string) => (n === '.env' ? 0 : /example|sample|dist|template/i.test(n) ? 2 : 1)
  names.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))

  const files: EnvFile[] = await Promise.all(names.map(async name => ({
    name,
    values: parseEnv(await readFile(join(projectPath, name), 'utf-8').catch(() => ''))
  })))
  return { projectPath, files }
}

/** Edit values in place: keeps comments, order and untouched lines. */
export async function writeEnvValues(projectPath: string, fileName: string, changes: Record<string, string | null>): Promise<void> {
  assertProject(projectPath)
  assertName(fileName)
  const path = join(projectPath, fileName)
  const original = existsSync(path) ? await readFile(path, 'utf-8') : ''
  await writeFile(path, applyEnvChanges(original, changes), 'utf-8')
}

export const isEnvName = (name: string) => ENV_NAME.test(name)

/** The text of an env file with values set (null removes the key): comments, order and other lines stay */
export function applyEnvChanges(original: string, changes: Record<string, string | null>): string {
  const eol = original.includes('\r\n') ? '\r\n' : '\n'
  const pending = new Map(Object.entries(changes))

  const lines = original === '' ? [] : original.split(/\r?\n/)
  const out: string[] = []
  for (const line of lines) {
    const m = !/^\s*#/.test(line) && line.match(KEY_LINE)
    if (m && pending.has(m[1])) {
      const value = pending.get(m[1])!
      pending.delete(m[1])
      if (value !== null) out.push(`${m[1]}=${quoteIfNeeded(value)}`)
      continue // null = removed
    }
    out.push(line)
  }
  // New keys go at the end
  while (out.length && out[out.length - 1] === '') out.pop()
  for (const [key, value] of pending) {
    if (value !== null) out.push(`${key}=${quoteIfNeeded(value)}`)
  }
  return out.join(eol) + eol
}

// ─── Encrypted backups ────────────────────────────────────────────────────────

interface BackupFile { savedAt: string; files: Record<string, string> }

function backupPath(projectPath: string): string {
  const id = createHash('sha256').update(projectPath.toLowerCase()).digest('hex').slice(0, 16)
  return join(app.getPath('userData'), 'env-backups', `${id}.bin`)
}

async function readBackup(projectPath: string): Promise<BackupFile | null> {
  const path = backupPath(projectPath)
  if (!existsSync(path)) return null
  const json = safeStorage.decryptString(await readFile(path))
  return JSON.parse(json) as BackupFile
}

export async function backupEnv(projectPath: string): Promise<EnvBackupInfo> {
  assertProject(projectPath)
  if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
  const names = (await readdir(projectPath)).filter(n => ENV_NAME.test(n))
  const files: Record<string, string> = {}
  for (const n of names) files[n] = await readFile(join(projectPath, n), 'utf-8')
  const data: BackupFile = { savedAt: new Date().toISOString(), files }
  const path = backupPath(projectPath)
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, safeStorage.encryptString(JSON.stringify(data)))
  return { savedAt: data.savedAt, files: names }
}

export async function envBackupInfo(projectPath: string): Promise<EnvBackupInfo> {
  assertProject(projectPath)
  const b = await readBackup(projectPath).catch(() => null)
  return { savedAt: b?.savedAt ?? null, files: b ? Object.keys(b.files) : [] }
}

export async function restoreEnv(projectPath: string): Promise<string[]> {
  assertProject(projectPath)
  const b = await readBackup(projectPath)
  if (!b) throw new Error('No backup for this project')
  const restored: string[] = []
  for (const [name, content] of Object.entries(b.files)) {
    if (!ENV_NAME.test(name)) continue
    await writeFile(join(projectPath, name), content, 'utf-8')
    restored.push(name)
  }
  return restored
}
