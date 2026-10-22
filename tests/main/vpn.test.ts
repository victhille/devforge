import { readFileSync, writeFileSync } from 'fs'
import { createServer, type IncomingMessage, type Server } from 'http'
import { connect, type AddressInfo } from 'net'
import { join } from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { dialog } from 'electron'
import { tempDir, userData } from '../helpers'

// Fake SSH: scripted command outputs, and port forwarding to a local fake wg-easy
const ssh = vi.hoisted(() => ({ outputs: [] as string[], commands: [] as string[], port: 0 }))
vi.mock('../../src/main/services/ssh/sshService', () => ({
  sshService: {
    connectForDashboard: async () => 'sid',
    disconnect: () => {},
    exec: async (_sid: string, command: string) => { ssh.commands.push(command); return ssh.outputs.shift() ?? '' },
    // Like an ssh2 channel: a Duplex without net.Socket's setTimeout / setNoDelay / setKeepAlive
    forwardOut: async () => Object.assign(connect(ssh.port, '127.0.0.1'), { setTimeout: undefined, setNoDelay: undefined, setKeepAlive: undefined })
  }
}))

const vpn = await import('../../src/main/services/vpn/vpnService')
const { closeAllForwards } = await import('../../src/main/services/ssh/localForward')

const PS = [
  'wg-easy|ghcr.io/wg-easy/wg-easy:15.2.2|0.0.0.0:51820->51820/udp, [::]:51820->51820/udp, 127.0.0.1:51821->51821/tcp',
  'n8n-n8n-1|ghcr.io/victhille/n8n-fr:latest|127.0.0.1:5678->5678/tcp'
].join('\n')

describe('vpn (wg-easy)', () => {
  let server: Server
  const calls: { method: string; url: string; auth: string; body: string }[] = []
  let clients: { id: number; name: string; enabled: boolean; ipv4Address: string; ipv6Address: string | null; createdAt: string | null; expiresAt: string | null; latestHandshakeAt: string | null; transferRx: number | null; transferTx: number | null }[] = [
    { id: 2, name: 'alice', enabled: true, ipv4Address: '10.8.0.2', ipv6Address: 'fdcc::2', createdAt: '2026-10-01T00:00:00Z', expiresAt: null, latestHandshakeAt: '2026-10-22T08:00:00Z', transferRx: 4_770_000, transferTx: 38_650_000 },
    { id: 4, name: 'Tommas', enabled: true, ipv4Address: '10.8.0.4', ipv6Address: null, createdAt: '2026-10-01T00:00:00Z', expiresAt: null, latestHandshakeAt: null, transferRx: null, transferTx: null }
  ]
  const good = 'Basic ' + Buffer.from('admin:s3cret:with:colons').toString('base64')
  const body = (req: IncomingMessage) => new Promise<string>(r => { let b = ''; req.on('data', c => { b += c }); req.on('end', () => r(b)) })

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      const b = await body(req)
      calls.push({ method: req.method!, url: req.url!, auth: String(req.headers.authorization), body: b })
      if (req.headers.authorization !== good) { res.statusCode = 401; res.end('{"statusMessage":"Session failed"}'); return }
      const m = /^\/api\/client\/(\d+)(\/.*)?$/.exec(req.url!)
      if (req.url === '/api/client' && req.method === 'GET') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(clients)); return }
      if (req.url === '/api/client' && req.method === 'POST') {
        const { name, expiresAt } = JSON.parse(b) as { name: string; expiresAt: string | null }
        clients.push({ id: 9, name, enabled: true, ipv4Address: '10.8.0.9', ipv6Address: null, createdAt: null as unknown as string, expiresAt, latestHandshakeAt: null, transferRx: null, transferTx: null })
        res.end(JSON.stringify({ success: true, clientId: 9 })); return
      }
      if (m && req.method === 'DELETE' && !m[2]) { clients = clients.filter(c => c.id !== Number(m[1])); res.end('{"success":true}'); return }
      if (m && (m[2] === '/enable' || m[2] === '/disable')) { clients.find(c => c.id === Number(m[1]))!.enabled = m[2] === '/enable'; res.end('{"success":true}'); return }
      if (m && m[2] === '/qrcode.svg') { res.setHeader('content-type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); return }
      if (m && m[2] === '/configuration') { res.setHeader('content-disposition', 'attachment; filename="alice.conf"'); res.end('[Interface]\nPrivateKey = abc\n'); return }
      res.statusCode = 404; res.end('{"statusMessage":"Not found"}')
    })
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
    ssh.port = (server.address() as AddressInfo).port
  })
  afterAll(() => { closeAllForwards(); server.close() })
  beforeEach(() => {
    ssh.outputs.length = 0; ssh.commands.length = 0; calls.length = 0
    writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'key', color: '', createdAt: '' }]))
  })

  it('finds wg-easy and its web port in docker ps', async () => {
    expect(vpn.parseDetect(PS)).toEqual({ found: true, container: 'wg-easy', image: 'ghcr.io/wg-easy/wg-easy:15.2.2', version: '15.2.2', port: 51821, supported: true })
    expect(vpn.parseDetect('wg|weejewel/wg-easy:7|0.0.0.0:51821->51821/tcp').supported).toBe(false)
    expect(vpn.parseDetect('wg|ghcr.io/wg-easy/wg-easy:latest|').port).toBeNull()
    expect(vpn.parseDetect('').found).toBe(false)
    ssh.outputs.push(PS)
    expect((await vpn.detect('v1')).port).toBe(51821)
  })

  it('checks the login before keeping it, encrypted', async () => {
    await expect(vpn.saveLogin('v1', 51821, 'admin', 'wrong')).rejects.toThrow('BAD_LOGIN')
    expect(vpn.listServers()).toEqual([])
    expect(await vpn.saveLogin('v1', 51821, ' admin ', 's3cret:with:colons')).toEqual({ connectionId: 'v1', port: 51821, username: 'admin' })
    expect(readFileSync(join(userData(), 'vpn.json'), 'utf-8')).not.toContain('s3cret')
  })

  it('lists, creates, toggles and deletes clients', async () => {
    const list = await vpn.clients('v1')
    expect(list.map(c => c.name)).toEqual(['Tommas', 'alice'])
    expect(list[1]).toMatchObject({ id: 2, ipv4: '10.8.0.2', ipv6: 'fdcc::2', transferTx: 38_650_000, latestHandshakeAt: '2026-10-22T08:00:00Z' })
    expect(calls.at(-1)!.auth).toBe(good)

    expect(await vpn.create('v1', ' Phone ', '2027-01-31')).toBe(9)
    expect(JSON.parse(calls.at(-1)!.body)).toEqual({ name: 'Phone', expiresAt: '2027-01-31T00:00:00.000Z' })
    await expect(vpn.create('v1', '   ', null)).rejects.toThrow('Invalid name')

    await vpn.setEnabled('v1', 9, false)
    expect(calls.at(-1)!.url).toBe('/api/client/9/disable')
    expect((await vpn.clients('v1')).find(c => c.id === 9)!.enabled).toBe(false)
    await vpn.remove('v1', 9)
    expect((await vpn.clients('v1')).map(c => c.id)).toEqual([4, 2])
    await expect(vpn.remove('v1', -1 as number)).rejects.toThrow('Invalid client')
  })

  it('gives the QR code as an image and saves the .conf where asked', async () => {
    expect(await vpn.qrcode('v1', 2)).toBe(`data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}`)
    const file = join(tempDir('vpn'), 'alice.conf')
    ;(dialog as unknown as { next: string }).next = file
    expect(await vpn.saveConfig('v1', 2, null)).toBe(file)
    expect(readFileSync(file, 'utf-8')).toContain('[Interface]')
    ;(dialog as unknown as { next: string }).next = ''
    expect(await vpn.saveConfig('v1', 2, null)).toBeNull()
  })

  it('opens wg-easy on this PC through the SSH session', async () => {
    const url = await vpn.openWeb('v1')
    expect(url).toMatch(/^http:\/\/localhost:\d+$/)
    expect(await vpn.openWeb('v1')).toBe(url)
    const res = await fetch(`${url}/api/client`, { headers: { authorization: good } })
    expect((await res.json()).length).toBe(2)
  })

  it('says when the saved login stopped working, and forgets it', async () => {
    const all = JSON.parse(readFileSync(join(userData(), 'vpn.json'), 'utf-8'))
    all.servers[0].passwordEnc = Buffer.from('ENC:' + Buffer.from('changed').toString('base64')).toString('base64')
    writeFileSync(join(userData(), 'vpn.json'), JSON.stringify(all))
    await expect(vpn.clients('v1')).rejects.toThrow('BAD_LOGIN')
    vpn.forget('v1')
    await expect(vpn.clients('v1')).rejects.toThrow('NO_LOGIN')
  })
})
