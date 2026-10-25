import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v2.3 lot 1: a database that refuses its password says why */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a refused password in a workshop explains the old Docker volume', async () => {
  run = await launch({
    env: { DEVFORGE_TEST_LARAVEL: '{userData}/laravel.json' },
    seed: data => {
      const dir = join(data, 'atelier')
      mkdirSync(join(dir, 'app', 'Models'), { recursive: true })
      writeFileSync(join(dir, 'composer.json'), JSON.stringify({ require: { 'laravel/framework': '^13.0' } }))
      writeFileSync(join(data, 'projects.json'), JSON.stringify([
        { id: 'lv', name: 'atelier', path: dir, framework: 'laravel', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(data, 'laravel.json'), JSON.stringify({
        status: {
          booted: true, error: null, version: '13.38.0', connection: 'pgsql', composeDatabase: true, api: true, faker: true,
          database: { reachable: false, error: 'SQLSTATE[08006] [7] connection to server at "127.0.0.1", port 5461 failed: FATAL:  password authentication failed for user "app"' }
        },
        migrations: [],
        routes: []
      }))
    }
  })
  const { page } = run
  await goTo(page, '/project/lv?tab=laravel')
  await page.getByRole('navigation', { name: 'Atelier Laravel' }).getByRole('button', { name: /Base de données/ }).click()
  await expect(page.getByRole('note')).toContainText("La base refuse l'identifiant ou le mot de passe")
  await expect(page.getByRole('note')).toContainText('Remets ce mot de passe dans .env')
  await expect(page.getByText('docker compose up -d --wait database')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})
