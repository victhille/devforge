import { writeFileSync } from 'fs'
import { join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VpsStatus, WatchAlert } from '@shared/types'
import { userData } from '../helpers'

// Fake SSH: each exec returns the next scripted output (or throws)
const ssh = vi.hoisted(() => ({ outputs: [] as (string | Error)[], commands: [] as string[] }))
vi.mock('../../src/main/services/ssh/sshService', () => ({
  sshService: {
    connectForDashboard: async () => 'sid',
    disconnect: () => {},
    exec: async (_sid: string, command: string) => {
      ssh.commands.push(command)
      const next = ssh.outputs.shift()
      if (next instanceof Error) throw next
      return next ?? ''
    }
  }
}))

const { appendPoint, readSeries, flushHistory, removeSeries, RETENTION_MS } = await import('../../src/main/services/monitor/history')
const { watchTick, startWatch, stopWatch, vpsStatuses, remoteDockerAction } = await import('../../src/main/services/monitor/vpsWatch')
const { Notification } = await import('electron') as unknown as { Notification: { shown: { title: string }[] } }

describe('history', () => {
  it('averages per bucket, ignores missing values and keeps 7 days', () => {
    const t0 = Date.UTC(2026, 9, 19, 10, 0)
    appendPoint('vps:h1', ['cpu', 'up'], [10, 1], t0 - RETENTION_MS - 1)
    appendPoint('vps:h1', ['cpu', 'up'], [20, 1], t0)
    appendPoint('vps:h1', ['cpu', 'up'], [40, 0], t0 + 60_000)
    appendPoint('vps:h1', ['cpu', 'up'], [null, 0], t0 + 120_000)
    const s = readSeries('vps:h1', 0, 15 * 60_000)
    expect(s.fields).toEqual(['cpu', 'up'])
    // The point older than the retention is gone; cpu ignores the missing value
    expect(s.points).toEqual([{ t: t0, v: [30, 0.33] }])
    flushHistory()
    removeSeries('vps:h1')
    expect(readSeries('vps:h1', 0, 60_000).points).toEqual([])
  })

  it('starts over when the fields change', () => {
    appendPoint('site:x', ['up'], [1], 1000)
    appendPoint('site:x', ['up', 'latency'], [1, 80], 2000)
    expect(readSeries('site:x', 0, 1000).points).toEqual([{ t: 2000, v: [1, 80] }])
  })
})

const SEP = '@@DF@@'
/** One sample's raw output: memory 50 %, disk at `disk` %, containers */
const sampleOutput = (disk: number, containers: string) => [
  'MemTotal:       2000000 kB\nMemFree:         500000 kB\nMemAvailable:   1000000 kB',
  '1000.5 2000.0\n§§§\n0.10 0.20 0.30 1/100 123',
  `/dev/sda1\t1000\t${disk * 10}\t${1000 - disk * 10}\t${disk}%\t/`,
  containers,
  ' 1  0      0 100000  10000 200000    0    0     1     2   10   20  5  3 90  2  0'
].join(`\n${SEP}\n`)

describe('VPS watch', () => {
  let statuses: VpsStatus[] = []
  const alerts: WatchAlert[] = []
  beforeEach(() => {
    ssh.outputs.length = 0
    alerts.length = 0
    writeFileSync(join(userData(), 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '10.0.0.1', port: 22, username: 'root', authMethod: 'key', color: '', createdAt: '' }]))
    startWatch(s => { statuses = s }, a => alerts.push(a))
    writeFileSync(join(userData(), 'watch.json'), JSON.stringify({ watched: ['v1'], diskAlert: 85 }))
  })

  it('samples a server, keeps history and alerts on changes only', async () => {
    ssh.outputs.push(sampleOutput(40, 'web|nginx|Up 2 hours\ndb|postgres|Up 2 hours'))
    await watchTick()
    expect(statuses[0]).toMatchObject({ connectionId: 'v1', name: 'Prod', state: 'ok', cpu: 10, memory: 50, disk: 40 })
    expect(statuses[0].containers.map(c => c.running)).toEqual([true, true])
    expect(alerts).toEqual([])

    // Disk crosses the threshold and a container stops: one alert each
    ssh.outputs.push(sampleOutput(90, 'web|nginx|Up 2 hours\ndb|postgres|Exited (1) 1 minute ago'))
    await watchTick()
    expect(alerts.map(a => a.kind).sort()).toEqual(['container', 'disk'])
    expect(alerts.find(a => a.kind === 'container')?.body).toContain('db')

    // Still high, nothing new: no repeated alert
    ssh.outputs.push(sampleOutput(91, 'web|nginx|Up 2 hours\ndb|postgres|Exited (1) 2 minutes ago'))
    await watchTick()
    expect(alerts).toHaveLength(2)

    // The server stops answering
    ssh.outputs.push(new Error('ECONNRESET'), new Error('ECONNRESET'))
    await watchTick()
    expect(vpsStatuses()[0]).toMatchObject({ state: 'down' })
    expect(alerts.at(-1)?.kind).toBe('server')
    expect(Notification.shown.length).toBeGreaterThanOrEqual(3)

    const points = readSeries('vps:v1', 0, 1).points
    expect(points.at(-1)?.v).toEqual([null, null, null, 0])
    expect(points[0].v).toEqual([10, 50, 40, 1])
    stopWatch()
  })

  it('only runs safe docker commands on the server', async () => {
    await expect(remoteDockerAction('v1', { container: 'web; rm -rf /' }, 'stop')).rejects.toThrow()
    ssh.outputs.push(`stopped\n${SEP}0`)
    expect(await remoteDockerAction('v1', { compose: { name: 'shop', status: '', configFiles: "/srv/shop/compose.yml,/srv/it's.yml" } }, 'up')).toEqual({ ok: true, output: 'stopped' })
    expect(ssh.commands.at(-1)).toContain("docker compose -p shop -f '/srv/shop/compose.yml' -f '/srv/it'\\''s.yml' up -d")
    stopWatch()
  })
})
