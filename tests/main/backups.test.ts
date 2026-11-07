import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tempDir, userData } from '../helpers'

// Fake SSH: scripted outputs, and SFTP that writes the remote path's name
const ssh = vi.hoisted(() => ({ outputs: [] as string[], commands: [] as string[], downloads: [] as string[] }))
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
    download: async (_sid: string, remote: string, local: string) => { ssh.downloads.push(remote); writeFileSync(local, `content of ${remote}`) }
  }
}))

const bk = await import('../../src/main/services/backups/backupsService')
const scripts = await import('../../src/main/services/backups/backupScripts')

// What the real VPS answered
const INSPECT = [
  '/wg-easy|ghcr.io/wg-easy/wg-easy:15.2.2|volume:wg-easy_etc_wireguard;bind:/lib/modules;',
  '/n8n-n8n-1|ghcr.io/victhille/n8n-fr:latest|volume:n8n_n8n_data;',
  '/n8n-postgres-1|postgres:16-alpine|volume:n8n_postgres_data;',
  '/portainer|portainer/portainer-ce:2.45.1|bind:/opt/utils/docker/_data/portainer;bind:/var/run/docker.sock;',
  '/dbadmin|phpmyadmin:5.2.3|',
  '/db|mariadb:11.4|bind:/opt/utils/docker/_data/db/data;bind:/opt/utils/docker/global/config-prod/db_custom.cnf;',
  '/tmp1|alpine|volume:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef;'
].join('\n')
const DIRS = new Set(['/lib/modules', '/opt/utils/docker/_data/portainer', '/opt/utils/docker/_data/db/data'])

const STATUS = { version: 1, day: '2026-10-22', startedAt: '2026-10-22T01:30:00Z', finishedAt: '2026-10-22T01:30:40Z', ok: true, size: 900, items: [{ kind: 'db', name: 'n8n-postgres-1', file: 'daily/2026-10-22/db-n8n-postgres-1.sql.gz', size: 600, ok: true, error: '' }] }
const FILES = [
  'daily/2026-10-21/db-n8n-postgres-1.sql.gz|500',
  'daily/2026-10-22/db-n8n-postgres-1.sql.gz|600',
  'daily/2026-10-22/vol-opt_utils_docker__data_portainer.tar.gz|300',
  'weekly/2026-10-19/db-n8n-postgres-1.sql.gz|450',
  'daily/2026-10-22/../../etc/passwd|1'
].join('\n')
const stateOut = (status: object | null = STATUS, cron = '1') => [status ? JSON.stringify(status) : '', cron, FILES].join('\n@@DF@@\n')

describe('backups', () => {
  beforeEach(() => {
    ssh.outputs.length = 0; ssh.commands.length = 0; ssh.downloads.length = 0
    writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod: VPS', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
  })

  it('finds databases, volumes and data folders, leaving system paths and files out', () => {
    const c = bk.parseCandidates(INSPECT, DIRS)
    expect(c.databases.map(d => [d.container, d.engine])).toEqual([['db', 'mariadb'], ['n8n-postgres-1', 'postgres']])
    expect(c.volumes.map(v => [v.name, v.kind, v.databaseData])).toEqual([
      ['/opt/utils/docker/_data/db/data', 'folder', true],
      ['/opt/utils/docker/_data/portainer', 'folder', false],
      ['n8n_n8n_data', 'volume', false],
      ['n8n_postgres_data', 'volume', true],
      ['wg-easy_etc_wireguard', 'volume', false]
    ])
  })

  it('validates a plan', () => {
    const base = { connectionId: 'v1', databases: [{ engine: 'postgres' as const, container: 'n8n-postgres-1' }], volumes: ['/opt/utils/docker/_data/portainer'], time: '03:30', keepDaily: 7, keepWeekly: 4, localDir: '' }
    expect(bk.validatePlan(base)).toEqual(base)
    expect(() => bk.validatePlan({ ...base, time: '25:00' })).toThrow('Invalid time')
    expect(() => bk.validatePlan({ ...base, keepDaily: 0 })).toThrow('Invalid retention')
    expect(() => bk.validatePlan({ ...base, databases: [], volumes: ['/opt/../etc', 'bad name'] })).toThrow('NOTHING_TO_BACKUP')
  })

  it('installs the script and one cron line, then reads the state', async () => {
    ssh.outputs.push('Nightly backup at 03:30\n')
    expect(await bk.save({ connectionId: 'v1', databases: [{ engine: 'postgres', container: 'n8n-postgres-1' }], volumes: ['/opt/utils/docker/_data/portainer'], time: '3:30', keepDaily: 2, keepWeekly: 1, localDir: '' }, () => {})).toEqual({ ok: true })
    const cmd = ssh.commands.at(-1)!
    expect(cmd).toContain(scripts.CRON_TAG)
    expect(cmd).toContain('30 3 * * *')
    // The config travels base64-encoded: the targets are in it
    const config = Buffer.from(/echo (\S+) \| base64 -d > config/.exec(cmd.replace(/'\\''/g, "'"))![1]!, 'base64').toString()
    expect(config).toBe('KEEP_DAILY 2\nKEEP_WEEKLY 1\nDB postgres n8n-postgres-1\nVOL /opt/utils/docker/_data/portainer\n')

    ssh.outputs.push(stateOut())
    const st = await bk.state('v1')
    expect(st).toMatchObject({ scheduled: true, last: { day: '2026-10-22', ok: true }, plan: { time: '3:30' } })
    // Unsafe paths never reach the window
    expect(st.files.map(f => f.path)).toEqual([
      'daily/2026-10-22/db-n8n-postgres-1.sql.gz',
      'daily/2026-10-22/vol-opt_utils_docker__data_portainer.tar.gz',
      'daily/2026-10-21/db-n8n-postgres-1.sql.gz',
      'weekly/2026-10-19/db-n8n-postgres-1.sql.gz'
    ])
  })

  it('restores from the plan, with a safety copy first', async () => {
    ssh.outputs.push('Restored\n')
    await bk.restore('v1', 'daily/2026-10-22/db-n8n-postgres-1.sql.gz', () => {})
    const db = ssh.commands.at(-1)!
    expect(db.indexOf('pre-restore/')).toBeLessThan(db.indexOf('gunzip -c'))
    expect(db).toContain('pg_dumpall')
    ssh.outputs.push('Restored\n')
    await bk.restore('v1', 'daily/2026-10-22/vol-opt_utils_docker__data_portainer.tar.gz', () => {})
    expect(ssh.commands.at(-1)).toContain('-v /opt/utils/docker/_data/portainer:/data')
    await expect(bk.restore('v1', 'daily/2026-10-22/db-other.sql.gz', () => {})).rejects.toThrow('Unknown database')
    await expect(bk.restore('v1', '../../etc/passwd', () => {})).rejects.toThrow('Invalid backup file')
    expect(() => scripts.restoreScript('daily/2026-10-22/vol-x.tar.gz', { kind: 'vol', volume: '/opt/../etc' })).toThrow('Invalid volume')
  })

  it('copies the newest good night to this PC and keeps only the last days', async () => {
    const dir = tempDir('bk')
    const root = join(dir, 'Prod- VPS')
    for (const old of ['2026-10-19', '2026-10-20', '2026-10-21']) mkdirSync(join(root, old), { recursive: true })
    ssh.outputs.push('ok\n')
    await bk.save({ connectionId: 'v1', databases: [{ engine: 'postgres', container: 'n8n-postgres-1' }], volumes: ['/opt/utils/docker/_data/portainer'], time: '03:30', keepDaily: 2, keepWeekly: 1, localDir: dir }, () => {})

    ssh.outputs.push(stateOut())
    expect(await bk.copyLatest('v1')).toEqual({ day: '2026-10-22' })
    expect(ssh.downloads).toEqual(['devforge/backups/daily/2026-10-22/db-n8n-postgres-1.sql.gz', 'devforge/backups/daily/2026-10-22/vol-opt_utils_docker__data_portainer.tar.gz'])
    expect(readdirSync(join(root, '2026-10-22')).sort()).toEqual(['db-n8n-postgres-1.sql.gz', 'vol-opt_utils_docker__data_portainer.tar.gz'])
    expect(readdirSync(root).sort()).toEqual(['2026-10-21', '2026-10-22'])
    expect(JSON.parse(readFileSync(join(userData(), 'backups.json'), 'utf-8')).copies[0]).toMatchObject({ day: '2026-10-22', error: null })

    // Already there: nothing downloaded again
    ssh.outputs.push(stateOut())
    expect(await bk.copyLatest('v1')).toEqual({ day: null })
    // A failed night is not copied
    ssh.outputs.push(stateOut({ ...STATUS, day: '2026-10-23', ok: false }))
    expect(await bk.copyLatest('v1')).toEqual({ day: null })
    expect(existsSync(join(root, '2026-10-23'))).toBe(false)
  })
})
