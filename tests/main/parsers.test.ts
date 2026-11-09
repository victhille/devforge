import { describe, expect, it } from 'vitest'
import type { DbConnection } from '@shared/types'
import { managedDomains, withManagedBlock } from '../../src/main/services/domains/hostsFile'
import { normalizeRemote } from '../../src/main/services/deploy/deployDetect'
import { parseRemoteOutput, pickMatch } from '../../src/main/services/database/dbDetect'

describe('hosts file block', () => {
  const base = '127.0.0.1 localhost\r\n# keep me\r\n'

  it('adds, replaces and removes only the DevForge block', () => {
    const one = withManagedBlock(base, ['app.test'])
    expect(one.startsWith(base.trimEnd())).toBe(true)
    expect(managedDomains(one)).toEqual(['app.test', 'app.test'])
    expect(one).toContain('\r\n')

    const two = withManagedBlock(one, ['api.test', 'web.test'])
    expect(new Set(managedDomains(two))).toEqual(new Set(['api.test', 'web.test']))
    expect(two.match(/DevForge local domains \(managed/g)).toHaveLength(1)
    expect(two).toContain('# keep me')

    const none = withManagedBlock(two, [])
    expect(none).toBe('127.0.0.1 localhost\r\n# keep me\r\n')
    expect(managedDomains(none)).toEqual([])
  })
})

describe('normalizeRemote', () => {
  it('maps ssh and https remotes to the same key', () => {
    const key = 'github.com/me/repo'
    expect(normalizeRemote('git@github.com:Me/Repo.git')).toBe(key)
    expect(normalizeRemote('https://github.com/me/repo.git')).toBe(key)
    expect(normalizeRemote('https://token@github.com/me/repo/')).toBe(key)
    expect(normalizeRemote('ssh://git@github.com/me/repo')).toBe(key)
  })
})

describe('remote database detection', () => {
  const output = [
    'C|/db|mariadb:11.4|["MYSQL_ROOT_PASSWORD=x","MYSQL_USER=dbuser","MYSQL_PASSWORD=y"]|{"3306/tcp":null}|172.18.0.2 ',
    'C|/pg|postgres:17|["POSTGRES_USER=app","POSTGRES_PASSWORD=z","POSTGRES_DB=shop"]|{"5432/tcp":[{"HostIp":"127.0.0.1","HostPort":"5433"}]}|172.18.0.3 ',
    'C|/web|nginx:1.29|[]|{}|172.18.0.4 ',
    'L|127.0.0.1:5433',
    'L|0.0.0.0:3306'
  ].join('\n')

  it('reads docker containers and native services', () => {
    const found = parseRemoteOutput(output, 'vps', 'ssh1')
    expect(found.map(f => [f.type, f.host, f.port, f.user, f.database, f.source])).toEqual([
      ['mysql', '172.18.0.2', 3306, 'dbuser', undefined, 'docker'],
      ['postgres', '127.0.0.1', 5433, 'app', 'shop', 'docker'],
      ['mysql', '127.0.0.1', 3306, 'root', undefined, 'native']
    ])
    expect(found.every(f => f.sshConnectionId === 'ssh1')).toBe(true)
    expect(found[1].password).toBe('z')
  })

  it('picks the matching database for a saved connection', () => {
    const found = parseRemoteOutput(output, 'vps', 'ssh1')
    const conn = (c: Partial<DbConnection>) => ({ id: 'x', name: 'x', color: '', type: 'mysql', ...c }) as DbConnection
    expect(pickMatch(found, conn({ type: 'postgres', database: 'shop' }))?.port).toBe(5433)
    expect(pickMatch(found, conn({ type: 'mysql', port: 3306 }))?.host).toBe('172.18.0.2')
    expect(pickMatch(found, conn({ type: 'postgres', database: 'nope', port: 1 }))?.port).toBe(5433)
    expect(pickMatch([], conn({}))).toBeUndefined()
  })

  it('a variable holding | moves nothing, and a container never sends the password outside its server', () => {
    const tricky = [
      // Read from the left, the end of this variable would become the address, outside the server
      'C|/pg|postgres:17|["POSTGRES_PASSWORD=z","X=a|b|203.0.113.7 "]|{"5432/tcp":null}|172.18.0.3 ',
      // A container whose only address is a public one: left out
      'C|/odd|postgres:17|["POSTGRES_PASSWORD=w"]|{"5432/tcp":null}|198.51.100.9 ',
      // The host's network: no address of its own
      'C|/host|mysql:8|["MYSQL_ROOT_PASSWORD=r"]|{}|'
    ].join('\n')
    const found = parseRemoteOutput(tricky, 'vps', 'ssh1')
    expect(found.map(f => [f.origin, f.host, f.port, f.password])).toEqual([
      ['pg', '172.18.0.3', 5432, 'z'],
      ['host', '127.0.0.1', 3306, 'r']
    ])
  })
})
