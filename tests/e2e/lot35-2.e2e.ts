import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5 lot 2: a folder holding a back and a front is a group */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }

test('a group is detected, imported, unfolded on its card, and its page shows its projects side by side', async () => {
  run = await launch({
    seed: dir => {
      const fm = join(dir, 'code', 'FreelanceManager')
      file(join(fm, 'backend', 'composer.json'), JSON.stringify({ require: { 'symfony/framework-bundle': '7.*' } }))
      file(join(fm, 'frontend', 'package.json'), JSON.stringify({ dependencies: { react: '^19' }, scripts: { dev: 'vite', build: 'vite build' } }))
      file(join(fm, 'compose.yaml'), 'services: {}\n')
      // Already saved on its own: shows inside the group once the group is saved
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'front', name: 'frontend', path: join(fm, 'frontend'), framework: 'react', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false }]))
      writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', onboarded: true, launcherEnabled: false, defaultProjectsDir: join(dir, 'code') }))
    }
  })
  const { page } = run
  await goTo(page, '/projects')
  await expect(page.getByText('groupe · 2 projets · backend (Symfony), frontend (React)')).toBeVisible()
  await page.getByRole('button', { name: 'Importer' }).click()

  // The group's card, unfolded: each project with its own actions
  const card = page.locator('.df-rise', { has: page.getByRole('heading', { name: 'FreelanceManager' }) })
  await expect(card.getByText('groupe · 2 projets')).toBeVisible()
  await expect(card.getByText('backend', { exact: true })).toBeVisible()
  await expect(card.getByText('frontend', { exact: true })).toBeVisible()
  // The front saved before is not listed twice
  await expect(page.getByRole('heading', { name: 'frontend' })).toHaveCount(0)
  expect(await settledAxe(page)).toEqual([])

  await card.getByRole('button', { name: 'Replier le groupe' }).click()
  await expect(card.getByText('backend · frontend')).toBeVisible()
  await card.getByRole('button', { name: 'Déplier le groupe' }).click()

  // Its page: the projects side by side, the front's scripts, the back's workshop
  await card.getByRole('button', { name: 'Ouvrir la fiche' }).click()
  await expect(page.getByRole('heading', { name: 'Les 2 projets du groupe' })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'backend' }).getByRole('tab', { name: 'Symfony' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lancer dev' })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})
