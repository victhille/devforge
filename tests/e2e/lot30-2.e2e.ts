import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.0 lot 2: the first launch on an empty profile, and the pages that need a service nobody set up */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('first launch: the language, the accounts (Git identity), then nothing more to set up', async () => {
  run = await launch({
    env: { GIT_CONFIG_GLOBAL: '{userData}/gitconfig' },
    seed: dir => writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', defaultProjectsDir: dir, onboarded: false, launcherEnabled: false }))
  })
  const { page, userData } = run
  await expect(page.getByRole('dialog', { name: 'Bienvenue dans DevForge' })).toBeVisible()
  // The language switches at once, and back
  await page.getByRole('radio', { name: 'English' }).click()
  await expect(page.getByRole('radio', { name: 'English' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf-8')).language).toBe('en')
  await page.getByRole('radio', { name: 'Français' }).click()
  await expect(page.getByRole('dialog', { name: 'Bienvenue dans DevForge' })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  await page.getByRole('button', { name: 'Commencer' }).click()
  await page.getByRole('button', { name: 'Suivant' }).click()
  await expect(page.getByRole('heading', { name: 'Tes comptes' })).toBeVisible()
  await page.getByLabel('Nom', { exact: true }).fill('Alice Martin')
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.org')
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: 'Suivant' }).click()
  await page.getByRole('button', { name: 'Plus tard' }).click()
  await page.getByRole('button', { name: "C'est parti" }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(readFileSync(join(userData, 'gitconfig'), 'utf-8')).toContain('alice@example.org')
})

test('a page that needs a server says so and leads to Connections', async () => {
  run = await launch()
  const { page } = run
  await goTo(page, '/status')
  await expect(page.getByText('Aucun serveur configuré')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: 'Ajouter un serveur' }).click()
  await expect(page.getByRole('heading', { name: 'Serveurs (VPS)' })).toBeVisible()
})
