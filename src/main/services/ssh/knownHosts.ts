import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { createHash } from 'crypto'
import { app } from 'electron'
import { loadSettings } from '../settings/settingsService'
import { writeJsonFile } from '../../lib/jsonFile'

/** host:port → SHA256 fingerprint, like OpenSSH's known_hosts (trust on first use) */
type Store = Record<string, { fingerprint: string; firstSeen: string }>

function path(): string {
  return join(app.getPath('userData'), 'known_hosts.json')
}

function read(): Store {
  if (!existsSync(path())) return {}
  try { return JSON.parse(readFileSync(path(), 'utf-8')) as Store } catch { return {} }
}

function write(store: Store): void {
  mkdirSync(dirname(path()), { recursive: true })
  writeJsonFile(path(), store)
}

const hostKey = (host: string, port: number) => `${host.toLowerCase()}:${port}`

/** Same format as `ssh-keygen -lf`: SHA256:base64 without padding */
export function fingerprintOf(key: Buffer): string {
  return 'SHA256:' + createHash('sha256').update(key).digest('base64').replace(/=+$/, '')
}

export class HostKeyMismatchError extends Error {
  constructor(host: string, expected: string, got: string) {
    super(loadSettings().language === 'fr'
      ? `La clé SSH de ${host} a changé (attendue ${expected}, reçue ${got}). ` +
        "Le serveur a peut-être été réinstallé, ou quelqu'un intercepte la connexion. " +
        "Si le changement est normal, oubliez l'ancienne clé dans la fiche du serveur."
      : `The SSH key of ${host} has changed (expected ${expected}, got ${got}). ` +
        'The server may have been reinstalled, or someone may be intercepting the connection. ' +
        'If you trust the change, forget the old key in the server settings.')
    this.name = 'HostKeyMismatchError'
  }
}

/**
 * Verifier for ssh2's `hostVerifier`: accepts and remembers an unknown host,
 * accepts a known host only if its key did not change.
 */
export function makeHostVerifier(host: string, port: number, onMismatch: (err: HostKeyMismatchError) => void) {
  return (key: Buffer): boolean => {
    const id = hostKey(host, port)
    const fp = fingerprintOf(key)
    const store = read()
    const known = store[id]
    if (!known) {
      store[id] = { fingerprint: fp, firstSeen: new Date().toISOString() }
      write(store)
      return true
    }
    if (known.fingerprint === fp) return true
    onMismatch(new HostKeyMismatchError(host, known.fingerprint, fp))
    return false
  }
}

export function knownFingerprint(host: string, port: number): string | null {
  return read()[hostKey(host, port)]?.fingerprint ?? null
}

export function forgetHost(host: string, port: number): void {
  const store = read()
  delete store[hostKey(host, port)]
  write(store)
}
