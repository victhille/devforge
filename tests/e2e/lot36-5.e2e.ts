import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.6 lot 5: searching a whole project from its Files tab (this repository, read only) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a search in DevForge itself answers within a second, and a result opens at its line', async () => {
  const repo = resolve(__dirname, '..', '..')
  run = await launch({
    seed: dir => {
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'df', name: 'devforge', path: repo, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/df?tab=files')

  const box = page.getByRole('textbox', { name: 'Rechercher dans le projet' })
  await box.fill('export async function searchProject')
  // This test holds the same text: the app's code only
  await page.getByRole('textbox', { name: /^Fichiers :/ }).fill('src/**')
  const results = page.getByTestId('search-results')
  await expect(results.getByRole('status')).toHaveText('1 résultat(s) dans 1 fichier(s)', { timeout: 10_000 })
  // The best of two (the first one warms the disk cache)
  const once = () => page.evaluate(async root => (await window.devforge.searchProject(root, 'useState', { regex: false, caseSensitive: true, wholeWord: false, include: '' })).durationMs, repo)
  const timing = Math.min(await once(), await once())
  expect(timing).toBeLessThan(1000)

  // The result opens in the preview, at its line, highlighted
  await expect(results.getByText('src/main/services/system/projectSearch.ts')).toBeVisible()
  await results.getByRole('button', { name: /export async function searchProject/ }).click()
  const preview = page.getByTestId('file-preview')
  await expect(page.getByRole('region', { name: 'Aperçu de projectSearch.ts' })).toBeVisible()
  await expect(preview.getByTestId('line-band')).toBeVisible()
  await expect(preview.getByTestId('line-band')).toBeInViewport()
  expect(await settledAxe(page)).toEqual([])

  // Regex, case, file filter; an invalid regex says so
  await page.getByRole('button', { name: 'Expression régulière' }).click()
  await box.fill('MAX_(MATCHES|FILE)\\b')
  await page.getByRole('textbox', { name: /^Fichiers :/ }).fill('src/main/**')
  await expect(results.getByRole('status')).toContainText('dans 1 fichier(s)')
  await box.fill('(')
  await expect(page.getByRole('alert')).toContainText('Recherche invalide')

  // Escape: back to the tree
  await box.press('Escape')
  await expect(page.getByRole('button', { name: 'src' }).first()).toBeVisible()
})

test('long lines never widen the pane, the results scroll inside it, a line found twice shows once', async () => {
  run = await launch({
    seed: dir => {
      const web = join(dir, 'web')
      mkdirSync(join(web, 'config'), { recursive: true })
      writeFileSync(join(web, 'package.json'), '{}')
      // A minified-like line, and many lines found
      writeFileSync(join(web, 'config', 'cache.yaml'), [`app: ${'x'.repeat(3000)} te`, ...Array.from({ length: 200 }, (_, i) => `key${i}: system test`)].join('\n'))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'w', name: 'web', path: web, framework: 'unknown', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/w?tab=files')
  const box = page.getByRole('textbox', { name: 'Rechercher dans le projet' })
  await box.fill('te')
  const results = page.getByTestId('search-results')
  await expect(results.getByRole('status')).toHaveText('401 résultat(s) dans 1 fichier(s)')

  // The field and the results stay within the card
  const card = await page.locator('.overflow-hidden', { has: box }).last().boundingBox()
  const field = await box.boundingBox()
  expect(field!.x + field!.width).toBeLessThanOrEqual(card!.x + card!.width)
  const list = results.locator('xpath=..')
  const size = await list.evaluate(e => ({ right: e.getBoundingClientRect().right, scroll: e.scrollHeight > e.clientHeight, wide: e.scrollWidth > e.clientWidth }))
  expect(size.right).toBeLessThanOrEqual(card!.x + card!.width + 1)
  expect(size.scroll).toBe(true)
  expect(size.wide).toBe(false)

  // "system test": two matches on one line, one row with both marked
  const row = results.getByRole('button', { name: /^2 key0: system test$/ })
  await expect(row).toHaveCount(1)
  await expect(row.locator('mark')).toHaveText(['te', 'te'])
})
