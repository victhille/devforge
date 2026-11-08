import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** The home page of the « Forge » mock-up: the state chips, « Pick up again », Forgy's card; the first launch's steps */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'Alex', GIT_AUTHOR_EMAIL: 'alex@example.com', GIT_COMMITTER_NAME: 'Alex', GIT_COMMITTER_EMAIL: 'alex@example.com' } })

test('home: chips under the greeting, the last projects to pick up again, Forgy at hand', async () => {
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      const shop = join(dir, 'shop'), blog = join(dir, 'blog')
      for (const p of [shop, blog]) mkdirSync(p)
      writeFileSync(join(shop, 'package.json'), JSON.stringify({ name: 'shop', dependencies: { next: '15.0.0' } }))
      git(shop, 'init', '-q', '-b', 'main')
      git(shop, 'add', '-A')
      git(shop, 'commit', '-q', '-m', 'first')
      writeFileSync(join(shop, 'README.md'), '# shop\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'Shop', path: shop, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-11-07T10:00:00.000Z' },
        { id: 'p2', name: 'Blog', path: blog, framework: 'node', packageManager: 'npm', favorite: false, createdAt: '2026-01-02T00:00:00.000Z', lastOpenedAt: '2026-11-01T10:00:00.000Z' }
      ]))
      writeFileSync(join(dir, 'active-project.json'), JSON.stringify({ id: 'p1' }))
    }
  })
  const { page } = run
  await goTo(page, '/')

  await expect(page.getByRole('list', { name: 'En ce moment' })).toContainText('1 dépôt modifié')
  const resume = page.locator('section, div').filter({ has: page.getByRole('heading', { name: 'Reprendre', exact: true }) }).last()
  // The project opened last comes first, its button the main one
  await expect(page.getByRole('button', { name: /^Ouvrir (Shop|Blog)$/ })).toHaveText(['Ouvrir', 'Ouvrir'])
  await expect(page.getByRole('article').first()).toContainText('Shop')
  await expect(resume.getByRole('button', { name: 'Tous les projets' })).toBeVisible()

  await expect(page.getByRole('heading', { name: 'Forgy', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Envoyer à Forgy' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Demande à Forgy' }).fill('Comment lancer les tests ?')
  await expect(page.getByRole('button', { name: 'Envoyer à Forgy' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Revue des changements' })).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  await page.getByRole('button', { name: 'Ouvrir Shop' }).click()
  await expect(page.locator('main h1')).toHaveText('Shop')
})

test('first launch: the steps on the left, the current one marked, the done ones said', async () => {
  run = await launch({ settings: { onboarded: false, motion: 'reduced' } })
  const { page } = run
  const steps = page.getByRole('complementary', { name: 'Étapes' }).getByRole('listitem')
  await expect(steps).toHaveText(['1Bienvenue', '2Tes projets', '3Tes comptes', '4Forgy', '5C’est prêt'])
  await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step')
  expect(await settledAxeIssues(page)).toEqual([])
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step')
  await expect(steps.nth(0)).toContainText('(faite)')
  await expect(page.getByText('Tout se change plus tard dans les Paramètres.')).toBeVisible()
})
