import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { DATA_ENTRIES, backupData, readSchemaVersion } from './migrations'

/**
 * Start over, or take one's setup to another PC (v3.0 lot 4). Pure file work
 * on the data folder; the IPC asks first and restarts the app.
 */

/** Everything personal: the data, DevForge's own backups (copies of it) and the log. The dictation models stay (downloads, nothing personal). */
export const WIPED = [...DATA_ENTRIES, 'storage.json', 'backups', 'logs']

export function wipeData(dataDir: string): string[] {
  const gone = WIPED.filter(e => existsSync(join(dataDir, e)))
  for (const entry of gone) rmSync(join(dataDir, entry), { recursive: true, force: true })
  return gone
}

/** What an export carries: the setup, not the history, nor any secret */
export const EXPORTED = [
  'settings.json', 'projects.json', 'ssh-connections.json', 'databases.json', 'deploy.json', 'stacks.json',
  'domains.json', 'monitors.json', 'watch.json', 'n8n.json', 'backups.json', 'status.json', 'vpn.json',
  'active-project.json', 'project-links.json', 'assistant/config.json'
]

/** Encrypted values, passwords, tokens and keys: never in an export */
const SECRET = /(Enc|password|passphrase|token|secret|apiKey)$/i

export function stripSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSecrets)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([k]) => !SECRET.test(k)).map(([k, v]) => [k, stripSecrets(v)]))
  }
  return value
}

export interface ConfigExport {
  app: 'DevForge'
  format: 1
  version: string
  exportedAt: string
  files: Record<string, unknown>
}

export function exportConfig(dataDir: string, version: string, now = new Date()): ConfigExport {
  const files: Record<string, unknown> = {}
  for (const name of EXPORTED) {
    const file = join(dataDir, name)
    if (!existsSync(file)) continue
    try { files[name] = stripSecrets(JSON.parse(readFileSync(file, 'utf-8'))) } catch { /* not JSON: left out */ }
  }
  return { app: 'DevForge', format: 1, version, exportedAt: now.toISOString(), files }
}

/** Checks an export, then writes its files over the current ones (after a backup); returns their names */
export function importConfig(dataDir: string, raw: string): string[] {
  let bundle: Partial<ConfigExport>
  try { bundle = JSON.parse(raw) } catch { throw new Error('NOT_AN_EXPORT') }
  if (bundle?.app !== 'DevForge' || bundle.format !== 1 || !bundle.files || typeof bundle.files !== 'object') throw new Error('NOT_AN_EXPORT')
  const names = Object.keys(bundle.files).filter(n => EXPORTED.includes(n))
  if (!names.length) throw new Error('NOT_AN_EXPORT')
  backupData(dataDir, readSchemaVersion(dataDir), new Date(), 'manual')
  for (const name of names) {
    let content = stripSecrets(bundle.files[name])
    // The tour is for a new user: someone who imports a setup is not one
    if (name === 'settings.json' && content && typeof content === 'object') content = { ...content, onboarded: true }
    const file = join(dataDir, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(content, null, 2))
  }
  return names
}
