import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v2.3 lot 5: a Laravel project in Sail (status canned): every line goes through the container */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('Sail stopped: start it; the commands run in the app container', async () => {
  run = await launch({
    env: { DEVFORGE_TEST_LARAVEL: '{userData}/laravel.json' },
    seed: data => {
      const dir = join(data, 'escale')
      mkdirSync(join(dir, 'app', 'Models'), { recursive: true })
      writeFileSync(join(dir, 'composer.json'), JSON.stringify({ require: { 'laravel/framework': '^13.0' } }))
      writeFileSync(join(dir, 'compose.yaml'), 'services:\n    laravel.test:\n        image: sail-8.5/app\n')
      writeFileSync(join(data, 'projects.json'), JSON.stringify([
        { id: 'lv', name: 'escale', path: dir, framework: 'laravel', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(data, 'laravel.json'), JSON.stringify({
        status: {
          booted: false, error: 'SAIL_DOWN', version: null, connection: 'pgsql', composeDatabase: true, api: true, faker: true,
          sail: true, appUrl: 'http://localhost:8091', database: { reachable: false, error: null }
        },
        migrations: [],
        routes: []
      }))
    }
  })
  const { page } = run
  await goTo(page, '/project/lv?tab=laravel')
  await expect(page.getByRole('alert')).toContainText("Sail est arrêté : les conteneurs de l'appli ne tournent pas.")
  await expect(page.getByRole('button', { name: 'Démarrer Sail' }).first()).toBeVisible()
  await expect(page.getByText('docker compose up -d --wait', { exact: true }).first()).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  const nav = page.getByRole('navigation', { name: 'Atelier Laravel' })
  await nav.getByRole('button', { name: /Migrations/ }).click()
  await expect(page.getByText('docker compose exec -T -u sail laravel.test php artisan migrate --no-interaction')).toBeVisible()
  await nav.getByRole('button', { name: 'Serveur' }).click()
  await expect(page.getByText('docker compose stop')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvrir http://localhost:8091' })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})
