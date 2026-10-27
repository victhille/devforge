import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.3 lot 3: Composer in the Packages tab, next to npm (Packagist and Composer simulated) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

function seed(extra: object) {
  return (dir: string) => {
    const project = join(dir, 'boutique')
    mkdirSync(join(project, 'vendor', 'composer'), { recursive: true })
    writeFileSync(join(project, 'composer.json'), JSON.stringify({ name: 'acme/boutique', require: { php: '^8.2', 'laravel/framework': '^11.0' }, 'require-dev': { 'phpunit/phpunit': '^10.5' } }))
    writeFileSync(join(project, 'composer.lock'), '{}')
    writeFileSync(join(project, 'vendor', 'composer', 'installed.json'), JSON.stringify({ packages: [{ name: 'laravel/framework', version: 'v11.9.2' }, { name: 'phpunit/phpunit', version: '10.5.20' }] }))
    writeFileSync(join(project, 'package.json'), JSON.stringify({ devDependencies: { vite: '^5.0.0' } }))
    writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Boutique', path: project, framework: 'laravel', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
    writeFileSync(join(dir, 'packages.json'), JSON.stringify({
      latest: { 'laravel/framework': '11.31.0', 'phpunit/phpunit': '11.4.0', vite: '5.4.0' },
      audit: { total: 0, bySeverity: { info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, packages: {} },
      ...extra
    }))
  }
}

test('a Laravel project shows its Composer and npm packages side by side', async () => {
  run = await launch({ env: { DEVFORGE_TEST_PACKAGES: '{userData}/packages.json' }, seed: seed({}) })
  const { page } = run
  await goTo(page, '/project/p1?tab=packages')

  // Two cards: composer.json (php itself left out) and package.json
  await expect(page.getByText('composer.json', { exact: true })).toBeVisible()
  await expect(page.getByText('package.json', { exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /laravel\/framework/ })).toContainText('mineure')
  await expect(page.getByRole('row', { name: /phpunit\/phpunit/ })).toContainText('majeure')
  await expect(page.getByRole('row', { name: /^php / })).toHaveCount(0)
  await expect(page.getByRole('row', { name: /vite/ })).toContainText('mineure')
  await expect(page.getByRole('button', { name: 'Mettre à jour les compatibles (1)' })).toHaveCount(2)
  expect(await settledAxe(page)).toEqual([])
})

test('without Composer, the list stays readable and nothing can be updated', async () => {
  run = await launch({ env: { DEVFORGE_TEST_PACKAGES: '{userData}/packages.json' }, seed: seed({ composerMissing: true }) })
  const { page } = run
  await goTo(page, '/project/p1?tab=packages')
  await expect(page.getByRole('status').filter({ hasText: "Composer n'est pas installé sur ce PC" })).toBeVisible()
  await expect(page.getByRole('row', { name: /laravel\/framework/ }).getByRole('button', { name: 'Mettre à jour' })).toBeDisabled()
  // npm, beside it, still updates
  await expect(page.getByRole('row', { name: /vite/ }).getByRole('button', { name: 'Mettre à jour' })).toBeEnabled()
})
