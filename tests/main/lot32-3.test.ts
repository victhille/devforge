import { writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempDir, userData } from '../helpers'
import * as conn from '../../src/main/services/connections/connectionsService'
import { saveApiKey } from '../../src/main/services/n8n/n8nService'
import { SEP } from '../../src/main/services/status/statusScripts'
import { defaultConfig } from '../../src/main/services/status/statusScripts'

/** v3.2 lot 3: n8n and the status page's ntfy alerts in Settings › Connections (the server's answer simulated) */
const seed = () => {
  writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'mon-serveur', host: '203.0.113.10', port: 22, username: 'deploy', authMethod: 'password' }]))
  writeFileSync(join(userData(), 'n8n.json'), JSON.stringify({ instances: [{ connectionId: 'v1', domain: 'n8n.example.com', exposure: 'caddy', installedAt: '2026-10-27T10:00:00.000Z' }] }))
  writeFileSync(join(userData(), 'status.json'), JSON.stringify({ pages: [{ connectionId: 'v1', exposure: 'port', domain: '', installedAt: '2026-10-27T10:00:00.000Z' }] }))
}
const serverAnswers = (alerts: object) => {
  const file = join(tempDir('vps'), 'vps.json')
  const config = { ...defaultConfig('Statut'), alerts }
  writeFileSync(file, JSON.stringify({ statusOverview: ['yes', 'status|running', JSON.stringify(config), '', '', '', ''].join(SEP) }))
  process.env.DEVFORGE_TEST_VPS = file
}
afterEach(() => { delete process.env.DEVFORGE_TEST_VPS })

describe('v3.2 lot 3: n8n and alerts in Connections', () => {
  it('lists n8n and the status pages with their server, never a key', async () => {
    seed()
    const o = await conn.overview()
    expect(o.n8n).toEqual([{ connectionId: 'v1', server: 'mon-serveur', where: 'n8n.example.com', hasKey: false }])
    expect(o.statusPages).toEqual([{ connectionId: 'v1', server: 'mon-serveur', where: 'port 3901' }])

    expect(await conn.test('n8n', 'v1')).toEqual({ ok: false, detail: 'NO_KEY' })
    saveApiKey('v1', 'n8n_api_secret')
    const withKey = await conn.overview()
    expect(withKey.n8n[0].hasKey).toBe(true)
    expect(JSON.stringify(withKey)).not.toContain('n8n_api_secret')
    await conn.disconnect('n8n', 'v1')
    expect((await conn.overview()).n8n[0].hasKey).toBe(false)
  })

  it('reads the alerts on the server without giving the topic', async () => {
    seed()
    serverAnswers({ ntfy: { server: 'https://ntfy.sh', topic: 'sujet-secret' }, webhook: null })
    const a = await conn.alerts('v1')
    expect(a).toEqual({ ntfy: true, webhook: false })
    expect(JSON.stringify(a)).not.toContain('sujet-secret')

    serverAnswers({ ntfy: null, webhook: null })
    expect(await conn.alerts('v1')).toEqual({ ntfy: false, webhook: false })
    expect(await conn.test('alerts', 'v1')).toEqual({ ok: false, detail: 'NO_ALERTS' })
  })

  it('refuses a topic or a server ntfy would not take, before touching the server', async () => {
    seed()
    serverAnswers({ ntfy: null, webhook: null })
    await expect(conn.setNtfy('v1', 'https://ntfy.sh', 'un sujet avec des espaces')).rejects.toThrow('BAD_NTFY')
    await expect(conn.setNtfy('v1', 'ftp://ntfy.example.com', 'sujet')).rejects.toThrow('BAD_NTFY')
  })
})
