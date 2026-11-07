import { spawn, type ChildProcess } from 'child_process'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http'
import { readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempDir } from '../helpers'

const APP = resolve(__dirname, '../../src/main/services/status/status-app.mjs')

let child: ChildProcess | null = null
const servers: Server[] = []
afterEach(() => { child?.kill(); child = null; for (const s of servers.splice(0)) s.close() })

/** A local HTTP server; resolves with its port */
function serve(handler: (req: IncomingMessage, res: ServerResponse) => void): Promise<number> {
  return new Promise(res => {
    const s = createServer(handler)
    servers.push(s)
    s.listen(0, '127.0.0.1', () => res((s.address() as { port: number }).port))
  })
}

const waitFor = async <T>(read: () => T | undefined, ms = 15_000): Promise<T> => {
  const end = Date.now() + ms
  for (;;) {
    const v = read()
    if (v !== undefined) return v
    if (Date.now() > end) throw new Error('timeout')
    await new Promise(r => setTimeout(r, 200))
  }
}
const readJson = (dir: string, name: string) => { try { return JSON.parse(readFileSync(join(dir, name), 'utf-8')) } catch { return undefined } }

describe('v2.2 lot 4: the status service (Node, no dependency)', () => {
  it('checks, opens an incident, alerts by ntfy, recovers, serves only public things', async () => {
    const dir = tempDir('status')
    let siteUp = true
    const site = await serve((_q, r) => { r.writeHead(siteUp ? 200 : 503).end('hi') })
    const alerts: { title: string; body: string; priority: string }[] = []
    const ntfy = await serve((q, r) => {
      let body = ''
      q.on('data', c => { body += c })
      q.on('end', () => {
        const m = JSON.parse(body) as { topic: string; title: string; message: string; priority: number }
        expect(m.topic).toBe('devforge-test')
        alerts.push({ title: m.title, body: m.message, priority: m.priority === 4 ? 'high' : 'default' })
        r.end('{}')
      })
    })
    writeFileSync(join(dir, 'config.json'), JSON.stringify({
      title: 'Services de test', intervalSec: 1, failuresBeforeDown: 2,
      monitors: [
        { id: 'site', name: 'Boutique', type: 'http', target: `http://127.0.0.1:${site}/`, public: true },
        { id: 'secret', name: 'Base interne', type: 'tcp', target: '127.0.0.1:9', public: false }
      ],
      alerts: { ntfy: { server: `http://127.0.0.1:${ntfy}`, topic: 'devforge-test' }, webhook: null }
    }))
    writeFileSync(join(dir, 'manual-incidents.json'), JSON.stringify([{ id: 'm1', title: 'Maintenance <b>prévue</b>', body: 'Mise à jour de PostgreSQL', startedAt: '2026-10-25T08:00:00Z', resolvedAt: '2026-10-25T08:20:00Z' }]))
    const port = await serve(() => {}).then(p => { servers.pop()!.close(); return p })
    child = spawn(process.execPath, [APP], { env: { ...process.env, STATUS_DIR: dir, PORT: String(port), BIND: '127.0.0.1', STATUS_MIN_INTERVAL: '1' }, stdio: 'ignore' })

    // The private monitor fails twice: down, one incident, one alert
    const state = await waitFor(() => { const s = readJson(dir, 'state.json'); return s?.monitors?.secret?.status === 'down' ? s : undefined })
    expect(state.monitors.site.status).toBe('up')
    await waitFor(() => alerts.length ? true : undefined)
    expect(alerts[0]).toMatchObject({ title: 'Base interne ne répond plus', priority: 'high' })
    expect(readJson(dir, 'incidents.json')[0]).toMatchObject({ monitorId: 'secret', title: 'Base interne indisponible', resolvedAt: null })

    // The public site goes down, then back: incident closed, two more alerts
    siteUp = false
    await waitFor(() => readJson(dir, 'state.json')?.monitors?.site?.status === 'down' ? true : undefined)
    siteUp = true
    await waitFor(() => readJson(dir, 'state.json')?.monitors?.site?.status === 'up' ? true : undefined)
    await waitFor(() => alerts.some(a => a.title === 'Boutique répond de nouveau') ? true : undefined)
    const siteIncident = readJson(dir, 'incidents.json').find((i: { monitorId: string }) => i.monitorId === 'site')
    expect(siteIncident.resolvedAt).not.toBeNull()

    // Public page and JSON: the private monitor never shows, text is escaped
    const json = await (await fetch(`http://127.0.0.1:${port}/status.json`)).json() as { monitors: { name: string; uptime: number; days: unknown[] }[]; incidents: { title: string }[] }
    expect(json.monitors.map(m => m.name)).toEqual(['Boutique'])
    expect(json.monitors[0].days).toHaveLength(90)
    expect(json.monitors[0].uptime).toBeLessThan(1)
    expect(json.incidents.map(i => i.title)).toEqual(['Boutique indisponible', 'Maintenance <b>prévue</b>'])
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text()
    expect(html).toContain('Services de test')
    expect(html).toContain('Tout fonctionne')
    expect(html).toContain('Maintenance &lt;b&gt;prévue&lt;/b&gt;')
    expect(html).not.toContain('Base interne')
    expect((await fetch(`http://127.0.0.1:${port}/config.json`)).status).toBe(404)
    expect((await fetch(`http://127.0.0.1:${port}/`, { method: 'POST' })).status).toBe(405)

    // A monitor taken out of the config: its open incident closes
    const cfg = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf-8'))
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ ...cfg, monitors: cfg.monitors.filter((m: { id: string }) => m.id !== 'secret') }))
    await waitFor(() => readJson(dir, 'incidents.json')?.find((i: { monitorId: string; resolvedAt: string | null }) => i.monitorId === 'secret')?.resolvedAt ? true : undefined)
  }, 60_000)
})

describe('v2.2 lot 4: scripts of the status page', async () => {
  const { cleanConfig, cleanIncidents, composeFile, installScript, n8nSite, sslipFor, uninstallScript, defaultConfig } = await import('../../src/main/services/status/statusScripts')

  it('an address without DNS setup', () => {
    expect(sslipFor('203.0.113.10')).toBe('status.203-0-113-10.sslip.io')
    expect(sslipFor('vps.example.com')).toBeNull()
  })

  it('compose per exposure', () => {
    const own = composeFile('caddy')
    expect(own).toContain('BIND: "127.0.0.1"')
    expect(own).toContain('  caddy:\n    image: caddy:2-alpine')
    expect(own.match(/network_mode: host/g)).toHaveLength(2)
    const n8n = composeFile('n8n')
    expect(n8n).toContain('BIND: "0.0.0.0"')
    expect(n8n).toContain('    name: n8n_default')
    expect(n8n).not.toContain('network_mode')
    expect(composeFile('port')).not.toContain('caddy')
    expect(n8nSite('status.x.fr')).toBe('# devforge-status\nstatus.x.fr {\n\tencode gzip\n\treverse_proxy devforge-status:3901\n}\n# /devforge-status\n')
  })

  it('install keeps the settings already made and puts the n8n block back once', () => {
    const script = installScript('n8n', 'status.x.fr', '', defaultConfig('VPS'))
    expect(script).toContain('[ -f data/config.json ] || echo ')
    expect(script.indexOf("awk '/^# devforge-status$/")).toBeLessThan(script.indexOf('cat site.caddy >> ~/devforge/n8n/Caddyfile'))
    expect(script).toContain('caddy reload --config /etc/caddy/Caddyfile')
    expect(installScript('port', '', '', defaultConfig('VPS'))).toContain('rm -f site.caddy')
    expect(uninstallScript()).toContain('rm -rf ~/devforge/status')
  })

  it('settings checked before they reach the server', () => {
    const base = defaultConfig('VPS')
    const ok = cleanConfig({ ...base, intervalSec: 5, monitors: [{ id: 'boutique', name: ' Boutique ', type: 'http', target: 'https://boutique.fr', public: true }], alerts: { ntfy: { server: 'https://ntfy.sh/', topic: 'devforge-abc123' }, webhook: '' } })
    expect(ok.intervalSec).toBe(30)
    expect(ok.monitors[0].name).toBe('Boutique')
    expect(ok.alerts).toEqual({ ntfy: { server: 'https://ntfy.sh', topic: 'devforge-abc123' }, webhook: null })
    expect(() => cleanConfig({ ...base, monitors: [{ id: 'x', name: 'X', type: 'http', target: 'file:///etc/passwd', public: true }] })).toThrow('BAD_URL')
    expect(() => cleanConfig({ ...base, monitors: [{ id: 'x', name: 'X', type: 'tcp', target: 'db;rm -rf /:5432', public: true }] })).toThrow('BAD_TCP')
    expect(() => cleanConfig({ ...base, alerts: { ntfy: { server: 'https://ntfy.sh', topic: 'a b' }, webhook: null } })).toThrow('BAD_NTFY')
    expect(cleanIncidents([{ id: 'm1', title: 'Maintenance', startedAt: '2026-10-25T08:00:00Z', resolvedAt: null, auto: false }, { id: 'a', title: 'Auto', startedAt: '2026-10-25T08:00:00Z', resolvedAt: null, auto: true }]))
      .toEqual([{ id: 'm1', title: 'Maintenance', body: '', startedAt: '2026-10-25T08:00:00.000Z', resolvedAt: null, auto: false }])
  })
})

describe('v2.2 lot 4: the firewall in front of the page', async () => {
  const { firewallBlocks } = await import('../../src/main/services/status/statusScripts')
  // The real output of the VPS before opening
  const vps = 'Status: active\nLogging: on (low)\nDefault: deny (incoming), allow (outgoing), deny (routed)\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW IN    Anywhere                   # SSH\n51820/udp                  ALLOW IN    Anywhere\n22/tcp (v6)                ALLOW IN    Anywhere (v6)              # SSH\n'

  it('reads what ufw keeps closed', () => {
    expect(firewallBlocks(vps)).toEqual([80, 443])
    expect(firewallBlocks(vps + '80/tcp                     ALLOW IN    Anywhere\n443/tcp                    ALLOW IN    Anywhere\n')).toEqual([])
    expect(firewallBlocks(vps + '80,443/tcp                 ALLOW IN    Anywhere\n')).toEqual([])
    expect(firewallBlocks('Status: inactive\n')).toEqual([])
    expect(firewallBlocks('')).toEqual([])
  })
})
