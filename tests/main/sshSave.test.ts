import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcMain, safeStorage, type BrowserWindow } from 'electron'
import type { SSHConnection } from '@shared/types'
import { registerSshHandlers } from '../../src/main/ipc/ssh'
import { getSshConnectionWithSecret, loadSshConnections } from '../../src/main/services/ssh/sshStorage'
import { userData } from '../helpers'

/** A saved server, through the IPC bridge: what a window may change, and where its password may go */

const { connect } = vi.hoisted(() => ({ connect: vi.fn(async (_conn: unknown) => 'session') }))
vi.mock('../../src/main/services/ssh/sshService', () => ({ sshService: { setCallbacks: () => {}, connect } }))

type Handler = (event: unknown, ...args: unknown[]) => unknown
const handlers = new Map<string, Handler>()
vi.spyOn(ipcMain, 'handle').mockImplementation(((channel: string, fn: Handler) => { handlers.set(channel, fn) }) as never)
registerSshHandlers({ webContents: { send: () => {} } } as unknown as BrowserWindow)

const call = async (channel: string, ...args: unknown[]) => handlers.get(channel)!({}, ...args)
const save = (conn: unknown) => call('ssh:save-connection', conn)
const file = () => join(userData(), 'ssh-connections.json')

/** What the form sends for a server */
const server = (over: Partial<SSHConnection> = {}): SSHConnection => ({
  id: 's1', name: 'vps', host: '203.0.113.10', port: 22, username: 'deploy', authMethod: 'password',
  color: '#4F8EF7', createdAt: '2026-11-09T10:00:00.000Z', ...over
})

beforeEach(() => rmSync(file(), { force: true }))

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
