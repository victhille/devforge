import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dialog, ipcMain, safeStorage, type BrowserWindow } from 'electron'
import type { SSHConnection } from '@shared/types'
import { registerSshHandlers } from '../../src/main/ipc/ssh'
import { getSshConnectionWithSecret, loadSshConnections } from '../../src/main/services/ssh/sshStorage'
import { buildSshConfig } from '../../src/main/services/ssh/sshClient'
import { knownFingerprint, makeHostVerifier } from '../../src/main/services/ssh/knownHosts'
import { disconnect } from '../../src/main/services/connections/connectionsService'
import { forgetSession, sessionFor } from '../../src/main/services/monitor/vpsWatch'
import { userData } from '../helpers'

/** A saved server, through the IPC bridge: what a window may change, and where its password may go */

const { connect, connectForDashboard, sshDisconnect, n8nFails } = vi.hoisted(() => ({
  connect: vi.fn(async (_conn: unknown) => 'session'),
  connectForDashboard: vi.fn(async (_conn: unknown) => 'watch-session'),
  sshDisconnect: vi.fn((_sid: string) => {}),
  n8nFails: { on: false }
}))
vi.mock('../../src/main/services/ssh/sshService', () => ({ sshService: { setCallbacks: () => {}, connect, connectForDashboard, disconnect: sshDisconnect } }))
// A file that cannot be written (an antivirus holding it, say), on demand
vi.mock('../../src/main/services/n8n/n8nService', async orig => {
  const real = await orig<typeof import('../../src/main/services/n8n/n8nService')>()
  return { ...real, forgetApiKey: (id: string) => { if (n8nFails.on) throw new Error('EBUSY'); real.forgetApiKey(id) } }
})

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: Handler) => { handlers.set(channel, fn) }) as never)
registerSshHandlers({ webContents: { send: () => {} } } as unknown as BrowserWindow)

const call = async (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args)
const save = (conn: unknown) => call('ssh:save-connection', conn)
const file = () => join(userData(), 'ssh-connections.json')
const enc = (s: string) => safeStorage.encryptString(s).toString('base64')
const json = (name: string) => JSON.parse(readFileSync(join(userData(), name), 'utf-8'))

/** What the form sends for a server */
const server = (over: Partial<SSHConnection> = {}): SSHConnection => ({
  id: 's1', name: 'vps', host: '203.0.113.10', port: 22, username: 'deploy', authMethod: 'password',
  color: '#4F8EF7', createdAt: '2026-11-09T10:00:00.000Z', ...over
})

beforeEach(() => {
  for (const name of ['ssh-connections.json', 'n8n.json', 'vpn.json', 'databases.json', 'known_hosts.json']) rmSync(join(userData(), name), { force: true })
})

describe('the saved password stays with its address', () => {
  it('a window that points a server to another host cannot send it the saved password', async () => {
    await save(server({ password: 'pw!' }))
    // What the window holds: the server as listed, then only the host changed
    await save({ ...loadSshConnections()[0], host: 'attacker.example' })
    await call('ssh:connect', 's1')
    const sent = connect.mock.lastCall![0] as SSHConnection
    expect(sent.host).toBe('attacker.example')
    expect(sent.password).toBeUndefined()
    expect(loadSshConnections()[0].hasPassword).toBe(false)
    expect(readFileSync(file(), 'utf-8')).not.toContain('passwordEnc')
  })

  it('a new port or another username forgets it too', async () => {
    for (const moved of [{ port: 2222 }, { username: 'root' }]) {
      await save(server({ password: 'pw!' }))
      await save(server(moved))
      expect(getSshConnectionWithSecret('s1')?.password, JSON.stringify(moved)).toBeUndefined()
    }
  })

  it('the same address keeps it: a new name or color, the host in other letters', async () => {
    await save(server({ host: 'VPS.example.org', password: 'pw!' }))
    await save(server({ host: ' vps.example.org ', name: 'prod', color: '#3DD68C' }))
    expect(getSshConnectionWithSecret('s1')).toMatchObject({ name: 'prod', host: 'vps.example.org', password: 'pw!' })
  })

  it('a new password typed with the new address is the one stored', async () => {
    await save(server({ password: 'old' }))
    await save(server({ host: '198.51.100.7', password: 'new' }))
    expect(getSshConnectionWithSecret('s1')?.password).toBe('new')
  })

  it('an old server saved without a port is on port 22', async () => {
    writeFileSync(file(), JSON.stringify([{ id: 's1', name: 'vps', host: '203.0.113.10', username: 'deploy', authMethod: 'password', passwordEnc: safeStorage.encryptString('pw!').toString('base64') }]))
    await save(server({ name: 'renamed' }))
    expect(getSshConnectionWithSecret('s1')).toMatchObject({ name: 'renamed', port: 22, password: 'pw!' })
  })
})

describe('what is kept for a server stays with its address', () => {
  /** n8n's API key, the wg-easy login, a database reached through the server and one that is not */
  const seedKept = () => {
    writeFileSync(join(userData(), 'n8n.json'), JSON.stringify({ instances: [{ connectionId: 's1', domain: '', exposure: 'port', installedAt: '', keyEnc: enc('n8n-key') }] }))
    writeFileSync(join(userData(), 'vpn.json'), JSON.stringify({ servers: [{ connectionId: 's1', port: 51821, username: 'admin', passwordEnc: enc('wg') }] }))
    writeFileSync(join(userData(), 'databases.json'), JSON.stringify([
      { id: 'via', name: 'shop', type: 'postgres', host: '127.0.0.1', port: 5432, user: 'shop', sshConnectionId: 's1', color: '', passwordEnc: enc('db-via') },
      { id: 'direct', name: 'local', type: 'mysql', host: '127.0.0.1', port: 3306, user: 'root', color: '', passwordEnc: enc('db-local') }
    ]))
  }
  const kept = () => ({
    n8n: !!json('n8n.json').instances[0].keyEnc,
    vpn: json('vpn.json').servers.length > 0,
    via: !!json('databases.json')[0].passwordEnc,
    direct: !!json('databases.json')[1].passwordEnc
  })

  it('a new address forgets n8n\'s key, the VPN login and the passwords of the databases through the server', async () => {
    await save(server({ password: 'pw!' }))
    seedKept()
    await save(server({ name: 'prod' }))
    expect(kept()).toEqual({ n8n: true, vpn: true, via: true, direct: true })
    await save(server({ host: 'attacker.example' }))
    expect(kept()).toEqual({ n8n: false, vpn: false, via: false, direct: true })
    // n8n itself stays listed: only its key is asked again
    expect(json('n8n.json').instances).toHaveLength(1)
  })

  it('removing the server forgets them, from SSH or from Connections, and a new server never inherits them', async () => {
    for (const remove of [() => call('ssh:remove-connection', 's1'), () => disconnect('server', 's1')]) {
      await save(server())
      seedKept()
      await remove()
      expect(kept()).toEqual({ n8n: false, vpn: false, via: false, direct: true })
    }
    // Left by an older version for an id now taken by another server
    seedKept()
    await save(server({ host: 'attacker.example' }))
    expect(kept()).toEqual({ n8n: false, vpn: false, via: false, direct: true })
  })

  it('when forgetting fails, the new address is not saved, and the next try forgets again', async () => {
    await save(server())
    seedKept()
    n8nFails.on = true
    await expect(save(server({ host: 'attacker.example' }))).rejects.toThrow('EBUSY')
    n8nFails.on = false
    expect(loadSshConnections()[0].host).toBe('203.0.113.10')
    // The other steps ran all the same
    expect(kept()).toEqual({ n8n: true, vpn: false, via: false, direct: true })
    await save(server({ host: 'attacker.example' }))
    expect(kept()).toEqual({ n8n: false, vpn: false, via: false, direct: true })
  })

  it('a watch session still opening to the old address is closed, not kept', async () => {
    await save(server())
    let opened!: (sid: string) => void
    connectForDashboard.mockImplementationOnce(() => new Promise<string>(resolve => { opened = resolve }))
    const pending = sessionFor('s1')
    forgetSession('s1')
    opened('old-address')
    await expect(pending).rejects.toThrow(/changed/)
    expect(sshDisconnect).toHaveBeenCalledWith('old-address')
    expect(await sessionFor('s1')).toBe('watch-session')
  })

  it('the server key is forgotten only once the user confirms it in a dialog of the main process', async () => {
    const answer = (n: number) => { (dialog as unknown as { answer: number }).answer = n }
    await save(server())
    makeHostVerifier('203.0.113.10', 22, () => {})(Buffer.from('host-key'))
    answer(1)
    expect(await call('ssh:forget-host-key', 's1')).toBe(false)
    expect(knownFingerprint('203.0.113.10', 22)).not.toBeNull()
    answer(0)
    expect(await call('ssh:forget-host-key', 's1')).toBe(true)
    expect(knownFingerprint('203.0.113.10', 22)).toBeNull()
    expect(await call('ssh:forget-host-key', 'unknown')).toBe(false)
    answer(1)
  })

  it('a key on a network share is never opened, even for a server saved by an older version or imported', () => {
    for (const privateKeyPath of ['\\\\attacker.example\\share\\id_ed25519', '//attacker.example/share/id_ed25519']) {
      expect(() => buildSshConfig(server({ authMethod: 'privateKey', privateKeyPath }))).toThrow(/network share/)
    }
  })
})

describe('what the bridge takes', () => {
  it('host names, IPv4 and IPv6 addresses, and a key on this PC', async () => {
    for (const host of ['vps.example.org', '203.0.113.10', '2001:db8::1', 'fe80::1%eth0']) {
      await save(server({ id: 'h', host }))
      expect(getSshConnectionWithSecret('h')?.host).toBe(host)
    }
    const key = 'C:\\Users\\me\\.ssh\\id_ed25519'
    await save(server({ id: 'k', authMethod: 'privateKey', privateKeyPath: key, password: 'not for a key' }))
    expect(getSshConnectionWithSecret('k')).toMatchObject({ privateKeyPath: key, password: undefined })
  })

  it('drops the fields the form never sends, a forged encrypted password among them', async () => {
    const forged = safeStorage.encryptString('chosen').toString('base64')
    await save({ ...server(), passwordEnc: forged, hasPassword: true, fingerprint: 'SHA256:x', extra: 'x' })
    const stored = JSON.parse(readFileSync(file(), 'utf-8'))[0]
    expect(Object.keys(stored).sort()).toEqual(['authMethod', 'color', 'createdAt', 'host', 'id', 'name', 'port', 'username'])
    expect(getSshConnectionWithSecret('s1')?.password).toBeUndefined()
  })

  it('refuses anything else, and stores nothing', async () => {
    const bad: unknown[] = [
      null, 'vps', [server()],
      { ...server(), id: '' }, { ...server(), id: '../s1' }, { ...server(), id: 42 },
      { ...server(), name: '   ' }, { ...server(), name: 'x'.repeat(201) },
      { ...server(), host: '' }, { ...server(), host: 'root@203.0.113.10' }, { ...server(), host: 'my server' },
      { ...server(), host: '-oProxyCommand=calc' }, { ...server(), host: 'vps\n' }, { ...server(), host: 'x'.repeat(256) },
      { ...server(), port: 0 }, { ...server(), port: 65536 }, { ...server(), port: 22.5 }, { ...server(), port: '22' }, { ...server(), port: undefined },
      { ...server(), username: '' }, { ...server(), username: 'deploy\u0000' },
      { ...server(), authMethod: 'agent' }, { ...server(), authMethod: undefined },
      { ...server(), password: 42 }, { ...server(), password: 'x'.repeat(1025) },
      { ...server(), authMethod: 'privateKey', privateKeyPath: '\\\\attacker.example\\share\\id_ed25519' },
      { ...server(), authMethod: 'privateKey', privateKeyPath: '//attacker.example/share/id_ed25519' },
      { ...server(), color: 'url(https://attacker.example/x)' }
    ]
    for (const conn of bad) await expect(save(conn), JSON.stringify(conn)).rejects.toThrow(/Invalid SSH server/)
    expect(existsSync(file())).toBe(false)
  })
})
