import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app, safeStorage } from 'electron'
import type { SSHConnection } from '@shared/types'
import { knownFingerprint } from './knownHosts'
import { writeJsonFile } from '../../lib/jsonFile'

/** On-disk shape: password is never stored in clear, only encrypted by the OS (DPAPI / Keychain / libsecret). */
interface StoredSSHConnection extends Omit<SSHConnection, 'password' | 'hasPassword'> {
  passwordEnc?: string
  /** Legacy plain-text field, migrated on first load */
  password?: string
}

function getPath(): string {
  return join(app.getPath('userData'), 'ssh-connections.json')
}

function encrypt(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption is not available: cannot store SSH password securely')
  }
  return safeStorage.encryptString(plain).toString('base64')
}

function decrypt(enc: string): string {
  return safeStorage.decryptString(Buffer.from(enc, 'base64'))
}

function readStored(): StoredSSHConnection[] {
  const path = getPath()
  if (!existsSync(path)) return []
  let conns: StoredSSHConnection[]
  try {
    conns = JSON.parse(readFileSync(path, 'utf-8')) as StoredSSHConnection[]
  } catch {
    return []
  }

  // Migrate legacy plain-text passwords
  if (conns.some(c => c.password) && safeStorage.isEncryptionAvailable()) {
    conns = conns.map(({ password, ...rest }) =>
      password ? { ...rest, passwordEnc: encrypt(password) } : rest
    )
    persist(conns)
  }
  return conns
}

function persist(conns: StoredSSHConnection[]): void {
  const path = getPath()
  mkdirSync(dirname(path), { recursive: true })
  writeJsonFile(path, conns)
}

/** Safe for the renderer: no password, only a flag. */
export function loadSshConnections(): SSHConnection[] {
  return readStored().map(({ passwordEnc, password, ...rest }) => ({
    ...rest,
    hasPassword: Boolean(passwordEnc || password),
    fingerprint: knownFingerprint(rest.host, rest.port)
  }))
}

/** Saved SSH server whose address is `host`, if any */
export function sshServerFor(host: string | undefined): SSHConnection | undefined {
  const h = host?.trim().toLowerCase()
  if (!h || h === '127.0.0.1' || h === 'localhost') return undefined
  return loadSshConnections().find(c => c.host.trim().toLowerCase() === h)
}

/** Main process only: includes the decrypted password, used to open the SSH session. */
export function getSshConnectionWithSecret(id: string): SSHConnection | undefined {
  const stored = readStored().find(c => c.id === id)
  if (!stored) return undefined
  const { passwordEnc, password, ...rest } = stored
  return { ...rest, password: passwordEnc ? decrypt(passwordEnc) : password }
}

/** An empty password keeps the one already stored. */
export function saveSshConnection(conn: SSHConnection): void {
  const conns = readStored()
  const idx = conns.findIndex(c => c.id === conn.id)
  const { password, hasPassword: _hasPassword, fingerprint: _fp, ...rest } = conn

  let passwordEnc: string | undefined
  if (conn.authMethod === 'password') {
    passwordEnc = password ? encrypt(password) : conns[idx]?.passwordEnc
  }

  const stored: StoredSSHConnection = passwordEnc ? { ...rest, passwordEnc } : rest
  if (idx >= 0) conns[idx] = stored
  else conns.push(stored)
  persist(conns)
}

export function removeSshConnection(id: string): void {
  persist(readStored().filter(c => c.id !== id))
}
