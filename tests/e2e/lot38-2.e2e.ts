import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v3.8 lot 2: GitHub CI alerts (a local stand-in for GitHub's API) */
let run: Launched
let server: Server
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
  server?.close()
})

test('a workflow that turns red rings and puts a dot on the card; back to green rings once more', async () => {
  // What GitHub answers, changed by the test
  let conclusion = 'success'
  server = createServer((req, res) => {
    if (!req.url?.startsWith('/repos/acme/shop/actions/runs')) { res.statusCode = 404; res.end('{}'); return }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ workflow_runs: [{ id: 1, name: 'CI', display_title: 'feat: cart', head_branch: 'main', event: 'push', status: 'completed', conclusion, run_number: 7, created_at: '2026-10-29T08:00:00Z', html_url: 'https://github.com/acme/shop/actions/runs/1' }] }))
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()))
  const port = (server.address() as AddressInfo).port

  run = await launch({
    env: { DEVFORGE_TEST_GITHUB_API: `http://127.0.0.1:${port}`, DEVFORGE_TEST_GITHUB_TOKEN: 'test-token-for-the-local-stand-in', DEVFORGE_TEST_CI_EVERY: '3600000' },
    seed: dir => {
      const shop = join(dir, 'shop')
      mkdirSync(shop, { recursive: true })
      writeFileSync(join(shop, 'package.json'), '{}')
      execFileSync('git', ['init', '-q'], { cwd: shop })
      execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/shop.git'], { cwd: shop })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: true, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { app, page } = run
  // The notifications shown, written down instead
  await app.evaluate(({ Notification }) => {
    const g = globalThis as unknown as { shown: string[] }
    g.shown = []
    Notification.prototype.show = function (this: Electron.Notification) { g.shown.push(`${this.title} — ${this.body}`) }
  })
  const shown = () => app.evaluate(() => (globalThis as unknown as { shown: string[] }).shown)
  const check = () => page.evaluate(() => window.devforge.github.checkCi())

  await goTo(page, '/projects')
  // Green: nothing rings, no dot
  await check()
  expect(await shown()).toEqual([])
  await expect(page.getByTestId('ci-dot')).toHaveCount(0)

  // Red: it rings, the card gets its dot
  conclusion = 'failure'
  await check()
  expect(await shown()).toEqual(['✗ shop · CI — GitHub Actions a échoué sur main'])
  await expect(page.getByTestId('ci-dot')).toHaveAttribute('aria-label', 'CI en échec : CI')

  // Still red: no second ring
  await check()
  expect(await shown()).toHaveLength(1)

  // Green again: one more ring, the dot goes
  conclusion = 'success'
  await check()
  expect((await shown())[1]).toBe('✓ shop · CI — De nouveau au vert sur main')
  await expect(page.getByTestId('ci-dot')).toHaveCount(0)

  // Turned off in Settings: nothing is asked any more
  await goTo(page, '/settings?section=general')
  await page.getByRole('radio', { name: 'Aucune' }).click()
  conclusion = 'failure'
  await check()
  expect(await shown()).toHaveLength(2)
})
