import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app, safeStorage } from 'electron'
import type { DbConnection } from '@shared/types'

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
  writeFileSync(path(), JSON.stringify(list, null, 2), 'utf-8')
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

/** Empty password on edit keeps the stored one */
export function saveDbConnection(c: DbConnection): void {
  const list = read()
  const i = list.findIndex(x => x.id === c.id)
  const { password, hasPassword: _h, ...rest } = c
  let passwordEnc = i >= 0 ? list[i].passwordEnc : undefined
  if (password) {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encryption is not available')
    passwordEnc = safeStorage.encryptString(password).toString('base64')
  }
  const stored: Stored = { ...rest, ...(passwordEnc ? { passwordEnc } : {}) }
  if (i >= 0) list[i] = stored; else list.push(stored)
  write(list)
}

export function removeDbConnection(id: string): void {
  write(read().filter(c => c.id !== id))
}
