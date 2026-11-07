import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.3 lot 2: the Packages tab (registry, audit and the update command simulated) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('the Packages tab shows what is behind, what is vulnerable, and updates on request', async () => {
  run = await launch({
    env: { DEVFORGE_TEST_PACKAGES: '{userData}/packages.json' },
    seed: dir => {
      const project = join(dir, 'shop')
      const reactDir = join(project, 'node_modules', 'react')
      mkdirSync(reactDir, { recursive: true })
      writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'shop', dependencies: { react: '^18.2.0', next: '^14.0.0' }, devDependencies: { vitest: '^1.6.0' } }))
      writeFileSync(join(project, 'package-lock.json'), '{}')
      writeFileSync(join(reactDir, 'package.json'), JSON.stringify({ version: '18.2.0' }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Shop', path: project, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
      // The update "installs" react 18.3.1, as npm would
      const bump = `node -e "require('fs').writeFileSync('node_modules/react/package.json', JSON.stringify({ version: '18.3.1' }))"`
      writeFileSync(join(dir, 'packages.json'), JSON.stringify({
        latest: { react: '18.3.1', next: '15.0.0', vitest: '1.6.0' },
        audit: { total: 1, bySeverity: { info: 0, low: 0, moderate: 0, high: 1, critical: 0 }, packages: { next: 'high' } },
        update: bump
      }))
    }
  })
  const { page } = run
  await goTo(page, '/project/p1')
  await page.getByRole('tab', { name: 'Paquets' }).click()

  // Behind: react (minor, within its range), next (major); vitest is up to date, so not in "Outdated"
  const table = page.getByRole('table')
  await expect(table.getByRole('row', { name: /react/ })).toContainText('mineure')
  await expect(table.getByRole('row', { name: /next/ })).toContainText('majeure')
  await expect(table.getByRole('row', { name: /vitest/ })).toHaveCount(0)
  await expect(table.getByRole('row', { name: /next/ }).getByRole('button', { name: 'Passer à 15.0.0' })).toBeVisible()

  // The audit, on request
  await page.getByRole('button', { name: 'Vérifier les vulnérabilités' }).click()
  await expect(page.getByText('1 vulnérabilité(s)')).toBeVisible()
  await expect(table.getByRole('row', { name: /next/ })).toContainText('élevée')
  expect(await settledAxe(page)).toEqual([])

  // Updating what stays compatible: react only, then it is up to date
  await page.getByRole('button', { name: 'Mettre à jour les compatibles (1)' }).click()
  await expect(page.getByText('1 paquet(s) mis à jour')).toBeVisible()
  await expect(table.getByRole('row', { name: /react/ })).toHaveCount(0)
  await page.getByRole('radio', { name: 'Tous' }).click()
  await expect(table.getByRole('row', { name: /react/ })).toContainText('18.3.1')
})
