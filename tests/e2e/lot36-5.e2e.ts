import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
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
  const timing = await page.evaluate(async root => (await window.devforge.searchProject(root, 'useState', { regex: false, caseSensitive: true, wholeWord: false, include: '' })).durationMs, repo)
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
