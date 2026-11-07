import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { seedVitestProject } from './fakeVitest'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.7 lot 2: a failure unfolded, opened at its line, rerun once fixed, sent to Forgy */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a failure shows expected and received, opens at its line, reruns alone once fixed, goes to Forgy', async () => {
  let shop = ''
  run = await launch({
    seed: dir => {
      shop = join(dir, 'shop')
      seedVitestProject(shop)
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/p?tab=tests')
  await page.getByRole('button', { name: 'Lancer les tests (Vitest)' }).click()

  // The failure, unfolded under its test
  const failure = page.getByTestId('test-failure')
  await expect(failure).toContainText('expected 90 to be 85', { timeout: 30_000 })
  await expect(failure.getByRole('definition').first()).toHaveText('85')
  await expect(failure.getByRole('definition').last()).toHaveText('90')
  expect(await settledAxe(page)).toEqual([])

  // Failures only: the passing file and tests are hidden
  await page.getByRole('button', { name: 'Échecs seulement' }).click()
  await expect(page.getByTestId('test-file')).toHaveCount(1)
  await expect(page.getByTestId('test-files')).not.toContainText('adds the items')
  await page.getByRole('button', { name: 'Tous', exact: true }).click()

  // Forgy gets the test and its message
  await failure.getByRole('button', { name: 'Expliquer avec Forgy' }).click()
  await expect(page.getByText(/Ce test échoue dans le projet shop \(Vitest\) : « cart › applies the discount », à src\/cart\.test\.ts:6/)).toBeVisible()
  await page.keyboard.press('Control+J')

  // Its place opens in the Files tab, at the line
  await failure.getByRole('button', { name: 'src/cart.test.ts:6' }).click()
  await expect(page).toHaveURL(/tab=files/)
  await expect(page.getByRole('region', { name: 'Aperçu de cart.test.ts' })).toBeVisible()
  await expect(page.getByTestId('line-band')).toBeVisible()

  // Fixed: "run the failures again" runs that file only, and it passes
  writeFileSync(join(shop, 'fixed'), '')
  await page.getByRole('tab', { name: 'Tests' }).click()
  await page.getByRole('button', { name: 'Relancer les échecs (1)' }).click()
  await expect(page.getByTestId('test-failure')).toHaveCount(0, { timeout: 30_000 })
  await expect(page.getByText('Échoués', { exact: true }).locator('..')).toContainText('0')
  await expect(page.getByLabel('Sortie des tests')).toContainText('src/cart.test.ts')
  await expect(page.getByLabel('Sortie des tests')).toContainText('"src/cart.test.ts"')
})
