import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app, safeStorage } from 'electron'
import type { DbConnection } from '@shared/types'
import { sameDbTarget } from '@shared/lib/dbTarget'
import { writeJsonFile } from '../../lib/jsonFile'
import { dataChanged } from '../../lib/changes'

interface Stored extends Omit<DbConnection, 'password' | 'hasPassword'> { passwordEnc?: string }

function path(): string {
  return join(app.getPath('userData'), 'databases.json')
}

function read(): Stored[] {
  if (!existsSync(path())) return []
  try { return JSON.parse(readFileSync(path(), 'utf-8')) as Stored[] } catch { return [] }
}

function write(list: Stored[]): void {
  mkdirSync(dirname(path()), { recursive: true })
  writeJsonFile(path(), list)
  // v4.2: every list of connections in the windows follows
  dataChanged('db-connections')
}

/** Renderer-safe list: no password */
export function listDbConnections(): DbConnection[] {
  return read().map(({ passwordEnc, ...c }) => ({ ...c, hasPassword: !!passwordEnc }))
}

/** Main process only: decrypted password */
export function getDbConnection(id: string): DbConnection | undefined {
  const s = read().find(c => c.id === id)
  if (!s) return undefined
  const { passwordEnc, ...c } = s
  return { ...c, password: passwordEnc ? safeStorage.decryptString(Buffer.from(passwordEnc, 'base64')) : undefined }
}

/**
 * An empty password on edit keeps the stored one, for the same target only (see sameDbTarget):
 * a connection pointed elsewhere forgets it, so it never goes to another server.
 */
export function saveDbConnection(c: DbConnection): void {
  const list = read()
  const i = list.findIndex(x => x.id === c.id)
  // An encrypted value sent by the window is dropped: only this file holds them
  const { password, hasPassword: _h, passwordEnc: _enc, ...rest } = c as DbConnection & { passwordEnc?: string }
  let passwordEnc = i >= 0 && sameDbTarget(list[i], c) ? list[i].passwordEnc : undefined
  if (password) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
    passwordEnc = safeStorage.encryptString(password).toString('base64')
  }
  const stored: Stored = { ...rest, ...(passwordEnc ? { passwordEnc } : {}) }
  if (i >= 0) list[i] = stored; else list.push(stored)
  write(list)
}

/** The stored password for settings not saved yet (a test before saving), if they still go to the same place */
export function storedPasswordFor(c: DbConnection): string | undefined {
  const s = read().find(x => x.id === c.id)
  return s && sameDbTarget(s, c) ? getDbConnection(c.id)?.password : undefined
}

/** The passwords of the databases reached through a server removed or pointed elsewhere; returns their ids */
export function forgetPasswordsThrough(sshConnectionId: string): string[] {
  const list = read()
  const hit = list.filter(c => c.sshConnectionId === sshConnectionId && c.passwordEnc)
  if (!hit.length) return []
  for (const c of hit) delete c.passwordEnc
  write(list)
  return hit.map(c => c.id)
}

export function removeDbConnection(id: string): void {
  write(read().filter(c => c.id !== id))
}
