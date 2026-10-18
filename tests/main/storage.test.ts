import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { getDbConnection, listDbConnections, saveDbConnection } from '../../src/main/services/database/dbStorage'
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
    writeFileSync(join(root, 'compose.yaml'), 'name: shop-online\nservices: {}\n')
    expect(composeDirFor(join(root, 'backend'))).toBe(root)
    expect(composeName(root)).toBe('shop-online')

    const plain = tempDir('My App')
    writeFileSync(join(plain, 'docker-compose.yml'), 'services: {}\n')
    expect(composeName(plain)).toMatch(/^myapp-/)
    expect(composeDirFor(tempDir('none'))).toBeNull()
  })
})
