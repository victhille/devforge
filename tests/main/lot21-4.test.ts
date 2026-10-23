import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveProjects, tempDir, userData } from '../helpers'

// Fake SSH: scripted command outputs
const ssh = vi.hoisted(() => ({ outputs: [] as string[], commands: [] as string[] }))
vi.mock('../../src/main/services/ssh/sshService', () => ({
  sshService: {
    connectForDashboard: async () => 'sid',
    disconnect: () => {},
    exec: async (_sid: string, command: string) => { ssh.commands.push(command); return ssh.outputs.shift() ?? '' }
  }
}))
// Fake `gh auth token` and `git remote get-url origin`
const cli = vi.hoisted(() => ({ gh: true, origin: 'git@github.com:victhille/devforge.git' }))
vi.mock('../../src/main/lib/exec', async orig => ({
  ...(await orig<typeof import('../../src/main/lib/exec')>()),
  runFile: async (file: string, args: string[]) => {
    if (file === 'gh') return cli.gh ? { ok: true, stdout: 'gho_0123456789abcdefghijklmnop\n', stderr: '' } : { ok: false, stdout: '', stderr: 'not logged in' }
    if (file === 'git' && args.includes('get-url')) return { ok: true, stdout: `${cli.origin}\n`, stderr: '' }
    return { ok: false, stdout: '', stderr: 'unexpected' }
  }
}))

const { compareEnv, diffEnv, applyEnv } = await import('../../src/main/services/envfiles/envSync')
const gh = await import('../../src/main/services/github/githubService')
const { planAction } = await import('../../src/main/services/assistant/assistantActions')
const { runTool } = await import('../../src/main/services/assistant/assistantTools')

const SEP = '@@DF@@'

describe('.env sync with a deployed copy', () => {
  let dir: string
  beforeEach(() => {
    ssh.outputs.length = 0; ssh.commands.length = 0
    dir = tempDir('app')
    saveProjects([{ name: 'app', path: dir }])
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\n# comment\nC=3\n')
    writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
    writeFileSync(join(userData(), 'deploy.json'), JSON.stringify({ targets: [{ id: 't1', name: 'Prod app', connectionId: 'v1', remotePath: '/srv/app/', script: '', projectPath: dir }] }))
  })

  it('compares keys without values', () => {
    expect(compareEnv({ A: '1', B: '2', C: '3' }, { A: '1', B: '9', D: '4' })).toEqual([
      { key: 'A', status: 'same' }, { key: 'B', status: 'different' }, { key: 'C', status: 'local' }, { key: 'D', status: 'remote' }
    ])
  })

  it('pushes the chosen keys, the server file saved first; then pulls one back here', async () => {
    ssh.outputs.push(`A=1\nB=9\nD=4\n${SEP}yes`)
    const d = await diffEnv('t1', '.env', '.env')
    expect(d).toMatchObject({ remotePath: '/srv/app/.env', remoteExists: true })
    expect(d.keys.map(k => k.status)).toEqual(['same', 'different', 'local', 'remote'])
    expect(JSON.stringify(d)).not.toContain('9')

    ssh.outputs.push(`A=1\nB=9\nD=4\n${SEP}yes`, `${SEP}ok`)
    const r = await applyEnv('t1', '.env', '.env', 'push', ['B', 'C', 'D'])
    expect(r.changed).toBe(3)
    const cmd = ssh.commands.at(-1)!
    expect(cmd).toMatch(/cp -p '\/srv\/app\/\.env' '\/srv\/app\/\.env\.devforge-.*\.bak'/)
    // The server's file keeps its lines: B updated, C added, D removed (missing here)
    expect(Buffer.from(/echo (\S+) \| base64 -d/.exec(cmd)![1]!, 'base64').toString()).toBe('A=1\nB=2\nC=3\n')

    ssh.outputs.push(`A=1\nB=2\nD=4\n${SEP}yes`)
    expect(await applyEnv('t1', '.env', '.env', 'pull', ['D'])).toEqual({ changed: 1, backup: 'DevForge' })
    expect(readFileSync(join(dir, '.env'), 'utf-8')).toBe('A=1\nB=2\n# comment\nC=3\nD=4\n')
    // An encrypted copy of the project's .env was made before
    expect(readdirSync(join(userData(), 'env-backups')).length).toBe(1)
  })

  it('creates the server file when it does not exist, and refuses odd names', async () => {
    ssh.outputs.push(`${SEP}no`, `${SEP}ok`)
    await applyEnv('t1', '.env', '.env.production', 'push', ['A'])
    expect(ssh.commands.at(-1)).toContain('umask 077')
    await expect(diffEnv('t1', '.env', '../etc/passwd')).rejects.toThrow('Not an env file')
  })
})

describe('GitHub', () => {
  const calls: { url: string; method: string; auth: string }[] = []
  const runs = [
    { id: 11, name: 'CI', display_title: 'fix: x', head_branch: 'main', event: 'push', status: 'completed', conclusion: 'failure', run_number: 7, created_at: '2026-10-23T08:00:00Z', html_url: 'https://github.com/r/11' },
    { id: 12, name: 'CI', display_title: 'feat: y', head_branch: 'main', event: 'push', status: 'completed', conclusion: 'success', run_number: 8, created_at: '2026-10-23T09:00:00Z', html_url: 'https://github.com/r/12' }
  ]
  let dir: string
  beforeEach(() => {
    calls.length = 0
    cli.gh = true
    dir = tempDir('gh')
    saveProjects([{ name: 'devforge', path: dir }])
    vi.stubGlobal('fetch', async (url: string, init: { method?: string; headers: Record<string, string> }) => {
      calls.push({ url, method: init.method ?? 'GET', auth: init.headers.authorization })
      const body = url.includes('/actions/runs?') ? { workflow_runs: runs }
        : url.includes('/pulls') ? [{ number: 3, title: 'PR', user: { login: 'v' }, head: { ref: 'feat' }, draft: false, created_at: '2026-10-22T00:00:00Z', html_url: 'u' }]
        : url.includes('/releases') ? [{ tag_name: 'v2.0.0', name: '', published_at: '2026-10-22T00:00:00Z', prerelease: false, draft: false, html_url: 'u' }]
        : {}
      return new Response(url.includes('rerun') ? null : JSON.stringify(body), { status: url.includes('rerun') ? 201 : 200 })
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('reads the repository of origin', () => {
    expect(gh.parseGithubUrl('https://github.com/victhille/n8n-fr.git')).toEqual({ owner: 'victhille', repo: 'n8n-fr' })
    expect(gh.parseGithubUrl('ssh://git@github.com/a/b')).toEqual({ owner: 'a', repo: 'b' })
    expect(gh.parseGithubUrl('https://gitlab.com/a/b.git')).toBeNull()
  })

  it('lists runs, pull requests and releases with GitHub CLI\'s token', async () => {
    const st = await gh.status(dir)
    expect(st).toMatchObject({ repo: { owner: 'victhille', repo: 'devforge' }, auth: 'gh', pulls: [{ number: 3, branch: 'feat' }], releases: [{ tag: 'v2.0.0', name: 'v2.0.0' }] })
    expect(st.runs.map(r => [r.id, r.conclusion])).toEqual([[11, 'failure'], [12, 'success']])
    expect(calls.every(c => c.auth === 'Bearer gho_0123456789abcdefghijklmnop')).toBe(true)
    cli.gh = false
    await expect(gh.status(dir)).rejects.toThrow('NO_TOKEN')
  })

  it('Forgy re-runs a failed run only, after approval', async () => {
    await expect(planAction('github_rerun', { project: 'devforge', run: 12 })).rejects.toThrow('did not fail')
    const plan = await planAction('github_rerun', { project: 'devforge', run: 11 })
    expect(plan.title).toBe('Re-run failed jobs · CI #7')
    expect(calls.some(c => c.method === 'POST')).toBe(false)
    await plan.run()
    expect(calls.at(-1)).toMatchObject({ method: 'POST', url: 'https://api.github.com/repos/victhille/devforge/actions/runs/11/rerun-failed-jobs' })
    expect(await runTool('github_status', { project: 'devforge' })).toContain('run 11 CI #7 [failure]')
  })
})

describe('Forgy and the VPS', () => {
  beforeEach(() => {
    ssh.outputs.length = 0
    writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
  })

  it('reads the services and refuses actions that are not set up', async () => {
    ssh.outputs.push('portainer|portainer/portainer-ce:2.45.1|127.0.0.1:9000->9000/tcp|running|Up\nblog|nginx|0.0.0.0:8081->80/tcp|running|Up')
    const text = await runTool('vps_services', {})
    expect(text).toContain('Portainer (portainer/portainer-ce:2.45.1) port 9000 running local only')
    expect(text).toContain('blog (nginx) port 8081 running OPEN TO THE INTERNET')
    await expect(planAction('backup_now', {})).rejects.toThrow('not turned on')
    await expect(planAction('vpn_create_client', { name: 'Phone' })).rejects.toThrow('wg-easy is not connected')
    await expect(runTool('vps_health', { server: 'Nope' })).rejects.toThrow('Unknown server')
    expect(existsSync(join(userData(), 'backups.json'))).toBe(false)
  })
})
