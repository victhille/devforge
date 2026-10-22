import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { createServer, type Server } from 'http'
import { connect, type AddressInfo } from 'net'
import { join } from 'path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveProjects, tempDir, userData } from '../helpers'

// Fake SSH: scripted command outputs, and port forwarding to a local fake n8n
const ssh = vi.hoisted(() => ({ outputs: [] as string[], commands: [] as string[], port: 0 }))
vi.mock('../../src/main/services/ssh/sshService', () => ({
  sshService: {
    connectForDashboard: async () => 'sid',
    disconnect: () => {},
    exec: async (_sid: string, command: string) => { ssh.commands.push(command); return ssh.outputs.shift() ?? '' },
    execStream: async (_sid: string, command: string, onData: (t: string) => void) => {
      ssh.commands.push(command)
      onData((ssh.outputs.shift() ?? '') + '@@DF@@0\n')
      return 0
    },
    // Like an ssh2 channel: a Duplex without net.Socket's setTimeout / setNoDelay / setKeepAlive
    forwardOut: async () => Object.assign(connect(ssh.port, '127.0.0.1'), { setTimeout: undefined, setNoDelay: undefined, setKeepAlive: undefined })
  }
}))

const { parseChangelog } = await import('../../src/shared/lib/changelog')
const { backupData, parseBackupName, restoreData } = await import('../../src/main/services/storage/migrations')
const n8n = await import('../../src/main/services/n8n/n8nService')
const { closeAllForwards } = await import('../../src/main/services/ssh/localForward')
const vercel = await import('../../src/main/services/vercel/vercelService')
const { planAction } = await import('../../src/main/services/assistant/assistantActions')

describe('changelog', () => {
  const md = [
    '# Notes', '',
    '## [2.0.0](https://x/compare/v1.5.0...v2.0.0) — 2026-11-03', '', '> Forgy acts.', '',
    '### Nouveautés', '', '- **assistant** : Forgy agit ([abc1234](https://x/commit/abc1234ffff))', '- Hub projet ([def5678](https://x/commit/def5678))', '',
    '### Corrections', '', '- Un bug ([0123456](https://x/commit/0123456))', '',
    '_1 changement(s) technique(s) non listé(s)._', '',
    '## [1.5.0](https://x) — 2026-10-19', '', '### Performances', '', '- Plus fluide', '',
    '## [1.4.1](https://x) — 2026-10-18', '', '### Fixes', '', '- A fix', '',
    '## 1.4.0 — 2026-10-18', ''
  ].join('\n')

  it('reads versions, kinds, summaries and items', () => {
    const v = parseChangelog(md)
    expect(v.map(x => [x.version, x.kind])).toEqual([['2.0.0', 'major'], ['1.5.0', 'minor'], ['1.4.1', 'patch'], ['1.4.0', 'major']])
    expect(v[0]).toMatchObject({ date: '2026-11-03', summary: 'Forgy acts.', note: '1 changement(s) technique(s) non listé(s).' })
    expect(v[0].items[0]).toEqual({ type: 'new', scope: 'assistant', text: 'Forgy agit', sha: 'abc1234', url: 'https://x/commit/abc1234ffff' })
    expect(v[0].items.map(i => i.type)).toEqual(['new', 'new', 'fix'])
    expect(v[1].items[0].type).toBe('better')
    expect(v[2].items[0].type).toBe('fix')
  })
})

describe('backups', () => {
  it('keeps the last five whatever the reason, and restores after a safety copy', () => {
    const dir = tempDir('data')
    writeFileSync(join(dir, 'settings.json'), '{"theme":"dark"}')
    for (let i = 0; i < 4; i++) backupData(dir, 1, new Date(Date.UTC(2026, 0, 1 + i)))
    const manual = backupData(dir, 1, new Date(Date.UTC(2026, 0, 10)), 'manual')
    backupData(dir, 1, new Date(Date.UTC(2026, 0, 11)), 'manual')
    const names = readdirSync(join(dir, 'backups'))
    expect(names).toHaveLength(5)
    expect(names.some(n => n.includes('2026-01-01'))).toBe(false)
    expect(parseBackupName(manual.split(/[\\/]/).pop()!)).toMatchObject({ reason: 'manual', version: 1 })

    writeFileSync(join(dir, 'settings.json'), '{"theme":"light"}')
    writeFileSync(join(dir, 'watch.json'), '{}')
    const safety = restoreData(dir, manual.split(/[\\/]/).pop()!)
    expect(readFileSync(join(dir, 'settings.json'), 'utf-8')).toBe('{"theme":"dark"}')
    // Not in the backup: gone, but kept in the safety copy
    expect(existsSync(join(dir, 'watch.json'))).toBe(false)
    expect(readFileSync(join(safety, 'settings.json'), 'utf-8')).toBe('{"theme":"light"}')
    expect(() => restoreData(dir, '../x')).toThrow()
  })
})

describe('n8n', () => {
  let server: Server
  const calls: { method: string; url: string; key: string }[] = []
  let status = 200
  beforeAll(async () => {
    server = createServer((req, res) => {
      calls.push({ method: req.method!, url: req.url!, key: String(req.headers['x-n8n-api-key']) })
      res.setHeader('content-type', 'application/json')
      if (status !== 200) { res.statusCode = status; res.end('{"message":"unauthorized"}'); return }
      if (req.url!.startsWith('/api/v1/workflows?')) res.end(JSON.stringify({ data: [{ id: 'w2', name: 'Zeta', active: false, updatedAt: '2026-10-01', tags: [] }, { id: 'w1', name: 'Alpha', active: true, updatedAt: '2026-10-02', tags: [{ name: 'prod' }] }] }))
      else if (req.url === '/api/v1/workflows/w2/activate') res.end(JSON.stringify({ id: 'w2', name: 'Zeta', active: true, updatedAt: '2026-10-03' }))
      else if (req.url === '/api/v1/workflows/w1') res.end(JSON.stringify({ id: 'w1', name: 'Alpha é', active: true, updatedAt: '2026-10-02', nodes: [] }))
      else if (req.url!.startsWith('/api/v1/executions?')) res.end(JSON.stringify({ data: [{ id: '9', workflowId: 'w1', status: 'error', startedAt: '2026-10-19T10:00:00Z', mode: 'trigger' }] }))
      else { res.statusCode = 404; res.end('{}') }
    })
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
    ssh.port = (server.address() as AddressInfo).port
  })
  afterAll(() => { server.close() })
  beforeEach(() => {
    ssh.outputs.length = 0; ssh.commands.length = 0; calls.length = 0; status = 200
    writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'key', color: '', createdAt: '' }]))
  })

  it('writes a compose file that keeps n8n off the internet and secrets on the server', () => {
    const local = n8n.composeFile('', 'local')
    expect(local).toContain('"127.0.0.1:5678:5678"')
    expect(local).not.toContain('caddy')
    const caddy = n8n.composeFile('n8n.example.com', 'caddy')
    expect(caddy).toContain('WEBHOOK_URL: https://n8n.example.com/')
    expect(caddy).toContain('"443:443"')
    const script = n8n.installScript('n8n.example.com', 'caddy', 'me@example.com')
    expect(script).toContain('if [ ! -f .env ]')
    expect(script).toContain('/dev/urandom')
    // Back to 'local' after an HTTPS install: the old Caddy goes away
    expect(script).toContain('docker compose up -d --remove-orphans')
    // Done only once the editor answers, not on n8n's early "Cannot GET /"
    expect(script.indexOf('wget -q -O /dev/null http://127.0.0.1:5678/')).toBeGreaterThan(script.indexOf('up -d --remove-orphans'))
    expect(n8n.updateScript()).toContain(n8n.waitEditor())
    expect(() => n8n.validateInstall({ domain: 'not a domain', exposure: 'caddy', email: 'me@example.com' })).toThrow('Invalid domain')
    expect(n8n.validateInstall({ domain: 'whatever', exposure: 'local', email: '' })).toEqual({ domain: '', exposure: 'local', email: '', locale: 'en' })
  })

  it('runs the community French image, pinned to the running version', () => {
    expect(n8n.composeFile('', 'local')).toContain('image: docker.n8n.io/n8nio/n8n:latest')
    const fr = n8n.composeFile('', 'local', 'fr')
    expect(fr).toContain('image: ghcr.io/victhille/n8n-fr:latest')
    expect(fr).toContain('      N8N_DEFAULT_LOCALE: fr\n')
    // The same n8n version in French, never an older one on the same database
    const script = n8n.localeScript('', 'local', 'fr')
    expect(script).toContain('docker pull -q ghcr.io/victhille/n8n-fr:"$V"')
    expect(script).toContain('sed -i "s#ghcr.io/victhille/n8n-fr:latest#ghcr.io/victhille/n8n-fr:$TAG#"')
    expect(script.indexOf('pg_dump')).toBeLessThan(script.indexOf('docker compose pull n8n'))
    expect(n8n.localeScript('', 'local', 'en')).not.toContain('n8n-fr:"$V"')
    // An update takes a pinned French image back to the newest one
    expect(n8n.updateScript()).toContain('ghcr.io/victhille/n8n-fr:latest#')
    expect(n8n.validateInstall({ domain: '', exposure: 'local', email: '', locale: 'fr' }).locale).toBe('fr')
  })

  it('checks the server, installs, then reads workflows through the tunnel', async () => {
    ssh.outputs.push(['Docker version 27.1', 'yes', '0.0.0.0:22\n0.0.0.0:80\n[::]:443', ''].join("\n@@DF@@\n"))
    expect(await n8n.precheck('v1')).toEqual({ docker: 'Docker version 27.1', compose: true, busyPorts: [80, 443], existing: false })

    const log: string[] = []
    ssh.outputs.push('Container n8n Started\n')
    expect(await n8n.install('v1', { domain: '', exposure: 'local', email: '' }, t => log.push(t))).toEqual({ ok: true })
    expect(log.join('')).toContain('Started')
    expect(ssh.commands.at(-1)).toContain('docker compose up -d')
    expect(n8n.listInstances()).toMatchObject([{ connectionId: 'v1', exposure: 'local', hasKey: false }])

    await expect(n8n.workflows('v1')).rejects.toThrow('NO_KEY')
    n8n.saveApiKey('v1', 'secret-key')
    // Stored encrypted, never in clear
    expect(readFileSync(join(userData(), 'n8n.json'), 'utf-8')).not.toContain('secret-key')

    expect((await n8n.workflows('v1')).map(w => w.name)).toEqual(['Alpha', 'Zeta'])
    expect(calls[0].key).toBe('secret-key')
    expect(await n8n.setActive('v1', 'w2', true)).toMatchObject({ id: 'w2', active: true })
    expect((await n8n.executions('v1', true))[0]).toMatchObject({ id: '9', workflowName: 'Alpha', status: 'error' })
    await expect(n8n.setActive('v1', '../x', true)).rejects.toThrow('Invalid workflow')

    const dir = tempDir('proj')
    saveProjects([{ name: 'shop', path: dir }])
    const file = await n8n.exportWorkflow('v1', 'w1', 'p0')
    expect(file).toBe(join(dir, 'n8n', 'alpha-e.json'))
    expect(JSON.parse(readFileSync(file, 'utf-8')).name).toBe('Alpha é')

    status = 401
    await expect(n8n.workflows('v1')).rejects.toThrow('BAD_KEY')
  })

  it('refuses an HTTPS install when the sub-domain does not point to the server', async () => {
    const dns = (answers: Record<string, string[]>) => async (name: string) => { if (!answers[name]) throw new Error('ENOTFOUND'); return answers[name] }
    const server = dns({ '10.0.0.1': ['10.0.0.1'] })
    expect(await n8n.checkDomain('v1', 'n8n.nowhere.fr', { domain: dns({}), server })).toEqual({ ok: false, domainIps: [], serverIps: ['10.0.0.1'] })
    expect((await n8n.checkDomain('v1', 'n8n.other.fr', { domain: dns({ 'n8n.other.fr': ['9.9.9.9'] }), server })).ok).toBe(false)
    expect((await n8n.checkDomain('v1', 'n8n.mine.fr', { domain: dns({ 'n8n.mine.fr': ['10.0.0.1'] }), server })).ok).toBe(true)
    // install() checks with the real DNS: a name under .invalid never resolves
    await expect(n8n.install('v1', { domain: 'n8n.devforge.invalid', exposure: 'caddy', email: 'me@example.com' }, () => {})).rejects.toThrow('DOMAIN_UNKNOWN')
  })

  it('switches the editor language and says when the French build is not ready', async () => {
    expect(n8n.listInstances()[0].locale).toBe('en')
    ssh.outputs.push('Backup: backups/n8n.sql.gz\n')
    expect(await n8n.setLocale('v1', 'fr', () => {})).toMatchObject({ locale: 'fr' })
    expect(ssh.commands.at(-1)).toContain('n8n-fr')
    const log: string[] = []
    ssh.outputs.push('Backup: backups/n8n.sql.gz\n@@DF@@FR_NOT_READY:2.50.1\n')
    await expect(n8n.setLocale('v1', 'fr', t => log.push(t))).rejects.toThrow('FR_NOT_READY:2.50.1')
    expect(log.join('')).not.toContain('FR_NOT_READY')
    expect(n8n.listInstances()[0].locale).toBe('fr')
    ssh.outputs.push('')
    expect(await n8n.setLocale('v1', 'en', () => {})).toMatchObject({ locale: 'en' })
  })

  it('opens n8n on this PC through the SSH session', async () => {
    const url = await n8n.openTunnel('v1')
    expect(url).toMatch(/^http:\/\/localhost:\d+$/)
    // Same tunnel when asked again
    expect(await n8n.openTunnel('v1')).toBe(url)
    const res = await fetch(`${url}/api/v1/workflows?limit=1`, { headers: { 'X-N8N-API-KEY': 'secret-key' } })
    expect((await res.json()).data[0].name).toBe('Zeta')
    closeAllForwards()
    await expect(fetch(url)).rejects.toThrow()
  })

  it('lets Forgy toggle a workflow with an undo', async () => {
    const plan = await planAction('n8n_set_workflow', { workflow: 'Zeta', active: true })
    expect(plan).toMatchObject({ title: 'Activate n8n workflow · Zeta', reversible: true })
    const r = await plan.run()
    expect(r.undo).toEqual({ type: 'n8n-active', connectionId: 'v1', workflowId: 'w2', active: false })
    await expect(planAction('n8n_set_workflow', { workflow: 'Alpha', active: true })).rejects.toThrow('already active')
  })
})

describe('Vercel', () => {
  const requests: { url: string; method: string; body?: string; auth: string }[] = []
  let dir: string
  beforeEach(() => {
    requests.length = 0
    dir = tempDir('site')
    mkdirSync(join(dir, '.vercel'))
    writeFileSync(join(dir, '.vercel', 'project.json'), JSON.stringify({ projectId: 'prj_1', orgId: 'team_9' }))
    writeFileSync(join(dir, '.env.local'), 'API_URL=x\nLOCAL_ONLY=y\n')
    saveProjects([{ name: 'site', path: dir }])
    vi.stubGlobal('fetch', async (input: URL, init: RequestInit) => {
      const url = String(input)
      requests.push({ url, method: init.method ?? 'GET', body: init.body as string | undefined, auth: String((init.headers as Record<string, string>).authorization) })
      const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s })
      if (url.includes('/v2/user')) return (init.headers as Record<string, string>).authorization === 'Bearer good' ? json({ user: { username: 'vic' } }) : json({ error: { message: 'no' } }, 403)
      if (url.includes('/v9/projects/prj_1?') || url.endsWith('/v9/projects/prj_1')) return json({ name: 'site', framework: 'nextjs', targets: { production: { id: 'dpl_a', alias: ['site.vercel.app'] } } })
      if (url.includes('/v6/deployments')) return json({ deployments: [
        { uid: 'dpl_b', url: 'site-b.vercel.app', state: 'READY', target: null, created: 2, meta: { githubCommitRef: 'feat', githubCommitMessage: 'New page\nbody' } },
        { uid: 'dpl_a', url: 'site-a.vercel.app', state: 'READY', target: 'production', created: 1, meta: {} }
      ] })
      if (url.includes('/v10/projects/prj_1/env')) return json({ envs: [{ key: 'API_URL', target: ['production', 'preview'] }, { key: 'REMOTE_ONLY', target: ['production'] }] })
      if (url.includes('/promote/')) return json({})
      return json({ error: { message: 'unexpected ' + url } }, 500)
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('keeps a checked token encrypted and reads the linked project', async () => {
    await expect(vercel.saveToken('bad')).rejects.toThrow('BAD_TOKEN')
    expect(await vercel.saveToken('good')).toEqual({ connected: true, username: 'vic' })
    expect(readFileSync(join(userData(), 'vercel.json'), 'utf-8')).not.toContain('good')

    const deps = await vercel.deployments('p0')
    expect(deps.map(d => [d.id, d.current, d.branch, d.commitMessage])).toEqual([['dpl_b', false, 'feat', 'New page'], ['dpl_a', true, null, null]])
    expect(requests.find(r => r.url.includes('/v6/deployments'))!.url).toContain('teamId=team_9')
    expect(requests.at(-1)!.auth).toBe('Bearer good')

    const env = await vercel.envDiff('p0')
    expect(env).toMatchObject({ localFile: '.env.local', missingRemote: ['LOCAL_ONLY'], missingLocal: ['REMOTE_ONLY'] })
  })

  it('lets Forgy promote a preview, with an undo to the previous production', async () => {
    await vercel.saveToken('good')
    await expect(planAction('vercel_promote', { project: 'site', deployment: 'dpl_a' })).rejects.toThrow('already points')
    const plan = await planAction('vercel_promote', { project: 'site', deployment: 'dpl_b' })
    expect(plan.title).toBe('Promote on Vercel · site')
    const r = await plan.run()
    expect(requests.at(-1)).toMatchObject({ method: 'POST' })
    expect(requests.at(-1)!.url).toContain('/v10/projects/prj_1/promote/dpl_b')
    expect(r.undo).toEqual({ type: 'vercel-promote', projectId: 'p0', deploymentId: 'dpl_a' })
  })
})
