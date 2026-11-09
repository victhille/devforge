import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { safeStorage } from 'electron'
import type { DbConnection } from '@shared/types'
import { forgetPasswordsThrough, getDbConnection, listDbConnections, saveDbConnection, storedPasswordFor } from '../../src/main/services/database/dbStorage'
import { getSshConnectionWithSecret, loadSshConnections, saveSshConnection, sshServerFor } from '../../src/main/services/ssh/sshStorage'
import { fingerprintOf, forgetHost, HostKeyMismatchError, knownFingerprint, makeHostVerifier } from '../../src/main/services/ssh/knownHosts'
import { composeDirFor, composeName } from '../../src/main/services/docker/composeProjects'
import { tempDir, userData } from '../helpers'

describe('secrets at rest', () => {
  it('DB passwords are encrypted on disk and never listed', () => {
    saveDbConnection({ id: 'd1', name: 'db', type: 'postgres', host: 'h', port: 5432, user: 'u', password: 'S3cret!', color: '' })
    expect(readFileSync(join(userData(), 'databases.json'), 'utf-8')).not.toContain('S3cret!')
    expect(listDbConnections()[0]).not.toHaveProperty('password')
    expect(listDbConnections()[0].hasPassword).toBe(true)
    expect(getDbConnection('d1')?.password).toBe('S3cret!')
  })

  it('saving without a password keeps the stored one', () => {
    saveDbConnection({ id: 'd2', name: 'db', type: 'mysql', host: 'h', password: 'keep', color: '' })
    saveDbConnection({ id: 'd2', name: 'renamed', type: 'mysql', host: 'h', color: '' })
    expect(getDbConnection('d2')).toMatchObject({ name: 'renamed', password: 'keep' })
  })

  it('a DB connection pointed elsewhere forgets its password; the same target written differently keeps it', () => {
    const base: DbConnection = { id: 'd3', name: 'db', type: 'postgres', host: 'db.example.org', user: 'shop', color: '' }
    saveDbConnection({ ...base, password: 'pw' })
    saveDbConnection({ ...base, name: 'renamed', host: 'DB.example.org', port: 5432, database: 'other' })
    expect(getDbConnection('d3')?.password).toBe('pw')
    for (const moved of [{ host: 'attacker.example' }, { port: 6543 }, { user: 'postgres' }, { sshConnectionId: 'v9' }, { type: 'mysql' as const }]) {
      saveDbConnection({ ...base, password: 'pw' })
      saveDbConnection({ ...base, ...moved })
      expect(getDbConnection('d3')?.password, JSON.stringify(moved)).toBeUndefined()
    }
  })

  it('a test before saving falls back on the stored password for the same target only; an encrypted value from the window is dropped', () => {
    const base: DbConnection = { id: 'd4', name: 'db', type: 'mysql', host: 'h', user: 'u', color: '' }
    saveDbConnection({ ...base, password: 'pw' })
    expect(storedPasswordFor({ ...base, name: 'renamed' })).toBe('pw')
    expect(storedPasswordFor({ ...base, host: 'attacker.example' })).toBeUndefined()
    saveDbConnection({ ...base, id: 'd5', passwordEnc: safeStorage.encryptString('chosen').toString('base64') } as DbConnection)
    expect(getDbConnection('d5')?.password).toBeUndefined()
    // Reached through a server pointed elsewhere: forgotten, and read again as forgotten
    saveDbConnection({ ...base, id: 'd6', sshConnectionId: 'v1', password: 'pw' })
    expect(forgetPasswordsThrough('v1')).toEqual(['d6'])
    expect(storedPasswordFor({ ...base, id: 'd6', sshConnectionId: 'v1' })).toBeUndefined()
  })

  it('SSH passwords are encrypted and old plain-text ones still load', () => {
    saveSshConnection({ id: 's1', name: 'vps', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'password', password: 'pw!', color: '', createdAt: '' })
    expect(readFileSync(join(userData(), 'ssh-connections.json'), 'utf-8')).not.toContain('pw!')
    expect(loadSshConnections()[0]).not.toHaveProperty('password')
    expect(getSshConnectionWithSecret('s1')?.password).toBe('pw!')
    expect(sshServerFor('10.0.0.1')?.id).toBe('s1')
    expect(sshServerFor('127.0.0.1')).toBeUndefined()
  })
})

describe('known hosts (trust on first use)', () => {
  const keyA = Buffer.from('host-key-A')
  const keyB = Buffer.from('host-key-B')

  it('remembers the first key, accepts it again, rejects a changed one', () => {
    let mismatch: Error | null = null
    const verify = makeHostVerifier('example.org', 22, e => { mismatch = e })
    expect(verify(keyA)).toBe(true)
    expect(knownFingerprint('EXAMPLE.org', 22)).toBe(fingerprintOf(keyA))
    expect(verify(keyA)).toBe(true)
    expect(verify(keyB)).toBe(false)
    expect(mismatch).toBeInstanceOf(HostKeyMismatchError)
    forgetHost('example.org', 22)
    expect(verify(keyB)).toBe(true)
  })

  it('formats fingerprints like ssh-keygen', () => {
    expect(fingerprintOf(keyA)).toMatch(/^SHA256:[A-Za-z0-9+/]+$/)
  })
})

describe('compose projects', () => {
  it('finds the compose file in the project or its parent and reads its name', () => {
    const root = tempDir('stack')
    mkdirSync(join(root, 'backend'))
    writeFileSync(join(root, 'compose.yaml'), 'name: Shop-Online\nservices: {}\n')
    expect(composeDirFor(join(root, 'backend'))).toBe(root)
    expect(composeName(root)).toBe('shop-online')

    const plain = tempDir('My App')
    writeFileSync(join(plain, 'docker-compose.yml'), 'services: {}\n')
    expect(composeName(plain)).toMatch(/^myapp-/)
    expect(composeDirFor(tempDir('none'))).toBeNull()
  })
})
