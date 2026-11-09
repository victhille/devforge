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
  'active-project.json', 'project-links.json', 'assistant/config.json', 'doc-commands.json', 'project-notes.json'
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
    // v4.2: Forgy's server addresses are given again by hand, never taken from a file (it could send the conversations elsewhere)
    if (name === 'assistant/config.json' && content && typeof content === 'object') {
      const { baseUrls: _baseUrls, ...rest } = content as Record<string, unknown>
      content = rest
    }
    const file = join(dataDir, name)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(content, null, 2))
  }
  // Imported servers may give the ids of this PC's servers to other machines
  if (names.includes('ssh-connections.json')) stripServerSecrets(dataDir)
  return names
}

type Json = Record<string, unknown>

/**
 * What this PC kept for its servers and sends through them, as serverChanges.forgetServerSecrets
 * forgets it for one server pointed elsewhere (a secret added there goes here too): n8n's API keys,
 * the wg-easy logins, the passwords of the databases reached through a server. Every server may have
 * changed here, so every login goes, not one; they are given again by hand, like the servers' own passwords.
 */
function stripServerSecrets(dataDir: string): void {
  const edit = (name: string, change: (data: unknown) => unknown) => {
    const file = join(dataDir, name)
    if (!existsSync(file)) return
    try { writeFileSync(file, JSON.stringify(change(JSON.parse(readFileSync(file, 'utf-8'))), null, 2)) } catch { /* not JSON: left as is */ }
  }
  const without = (o: unknown, key: string) => {
    if (!o || typeof o !== 'object') return o
    const { [key]: _gone, ...rest } = o as Json
    return rest
  }
  edit('n8n.json', d => ({ ...(d as Json), instances: ((d as Json)?.instances as unknown[] | undefined)?.map(i => without(i, 'keyEnc')) ?? [] }))
  edit('vpn.json', d => ({ ...(d as Json), servers: [] }))
  edit('databases.json', list => Array.isArray(list) ? list.map(c => ((c as Json)?.sshConnectionId ? without(c, 'passwordEnc') : c)) : list)
}
