import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** Monitoring history and the VPS side of Docker (no real server: unreachable on purpose) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('monitoring shows 24 h of a site and the watched servers', async () => {
  const now = Date.now()
  run = await launch({
    seed: dir => {
      // One incident of 12 minutes two days ago, one of 40 days ago (no longer counted)
      const incidents = [
        { start: new Date(now - 2 * 86_400_000).toISOString(), end: new Date(now - 2 * 86_400_000 + 12 * 60_000).toISOString() },
        { start: new Date(now - 40 * 86_400_000).toISOString(), end: new Date(now - 40 * 86_400_000 + 60_000).toISOString() }
      ]
      writeFileSync(join(dir, 'monitors.json'), JSON.stringify({
        monitors: [{ id: 'm1', name: 'Shop', url: 'http://127.0.0.1:9/', intervalSec: 60, enabled: false }],
        states: [{ id: 'm1', status: 'up', checks: [], since: null, incidents }]
      }))
      mkdirSync(join(dir, 'history'))
      // 4 checks in the last hour: 3 up, 1 down
      const rows = [[now - 3600_000, 1, 120], [now - 2400_000, 1, 80], [now - 1200_000, 0, null], [now - 60_000, 1, 100]]
      writeFileSync(join(dir, 'history', 'site_m1.json'), JSON.stringify({ fields: ['up', 'latency'], rows }))
      // A server nobody can reach, not watched
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'key', color: '', createdAt: '' }]))
      writeFileSync(join(dir, 'watch.json'), JSON.stringify({ watched: [], diskAlert: 85 }))
    }
  })
  const { page } = run
  await goTo(page, '/monitor')
  // The last 30 days of incidents: how many, and how long
  await expect(page.getByText('Incidents · 30 jours').locator('..')).toContainText('1')
  await expect(page.getByText('Incidents · 30 jours').locator('..')).toContainText('12 min')
  await expect(page.getByText(/Disponibilité 24 h : \d/)).toBeVisible()
  await expect(page.getByText('Temps de réponse')).toBeVisible()
  await expect(page.getByText('root@127.0.0.1 · non surveillé')).toBeVisible()

  // Docker: the VPS side lists the servers
  await goTo(page, '/docker')
  await page.getByRole('tab', { name: 'VPS' }).click()
  await expect(page.getByRole('combobox').filter({ hasText: 'Prod' })).toBeVisible()
})
