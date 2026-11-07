import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5 lot 1: several projects folders, scanned together */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const project = (dir: string, deps: Record<string, string>) => {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', dependencies: deps }))
}

test('projects of two folders show together, each with its folder; a gone folder is reported', async () => {
  run = await launch({
    seed: dir => {
      project(join(dir, 'Projet Perso', 'blog'), { react: '^19.0.0' })
      project(join(dir, 'Projet Cefim', 'shop'), { next: '^16.0.0', react: '^19.0.0' })
      writeFileSync(join(dir, 'settings.json'), JSON.stringify({
        language: 'fr', onboarded: true, launcherEnabled: false,
        defaultProjectsDir: join(dir, 'Projet Perso'), extraProjectsDirs: [join(dir, 'Projet Cefim'), join(dir, 'Parti')]
      }))
    }
  })
  const { page, userData } = run
  await goTo(page, '/projects')
  await expect(page.getByText('blog', { exact: true })).toBeVisible()
  await expect(page.getByText('shop', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Détectés dans tes dossiers' })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Dossier introuvable' })).toContainText('Parti')
  expect(await settledAxe(page)).toEqual([])

  // One folder at a time
  const folders = page.getByRole('group', { name: 'Dossier' })
  await folders.getByRole('button', { name: 'Projet Cefim' }).click()
  await expect(page.getByText('shop', { exact: true })).toBeVisible()
  await expect(page.getByText('blog', { exact: true })).toHaveCount(0)
  await folders.getByRole('button', { name: 'Tous les dossiers' }).click()
  await expect(page.getByText('blog', { exact: true })).toBeVisible()

  // Settings: the list, the first one by default; removing one deletes nothing
  await goTo(page, '/settings?section=general')
  await expect(page.getByLabel(/^Dossiers de projets \d$/)).toHaveCount(3)
  await expect(page.getByText('par défaut', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Retirer ce dossier' }).nth(2).click()
  await expect(page.getByLabel(/^Dossiers de projets \d$/)).toHaveCount(2)
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf-8')).extraProjectsDirs).toEqual([join(userData, 'Projet Cefim')])
  // The second one first: it becomes the default
  await page.getByRole('button', { name: 'Monter' }).nth(1).click()
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf-8')).defaultProjectsDir).toBe(join(userData, 'Projet Cefim'))
  expect(await settledAxe(page)).toEqual([])
})
