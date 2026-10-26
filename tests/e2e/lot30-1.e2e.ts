import { expect, test } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.0 lot 1: Settings › Connections on an empty profile (Git's global config redirected to the profile) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('an empty profile: nothing set; a key, a Git identity, a server added, tested and removed', async () => {
  run = await launch({ env: { GIT_CONFIG_GLOBAL: '{userData}/gitconfig' } })
  const { page } = run
  page.on('dialog', d => d.accept())
  await goTo(page, '/settings?section=connections')
  await expect(page.getByRole('heading', { name: 'Comptes et clés' })).toBeVisible()
  await expect(page.getByText('aucune clé')).toBeVisible()
  await expect(page.getByText('Aucun serveur', { exact: true })).toBeVisible()
  await expect(page.getByText('Aucune base enregistrée')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  // A key is saved, then only "saved" shows
  await page.getByLabel('Clé API Anthropic').fill('sk-ant-test-devforge')
  await page.getByLabel('Clé API Anthropic').press('Enter')
  await expect(page.getByText('clé enregistrée')).toBeVisible()
  await expect(page.getByLabel('Clé API Anthropic')).toHaveCount(0)
  await expect(page.locator('input[value="sk-ant-test-devforge"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retirer', exact: true }).click()
  await expect(page.getByText('aucune clé')).toBeVisible()

  // Git identity, in the redirected global config
  await page.getByLabel('Nom', { exact: true }).fill('Alice Martin')
  await page.getByLabel('E-mail', { exact: true }).fill('alice@example.org')
  await page.getByRole('button', { name: 'Enregistrer' }).nth(1).click()
  await expect(page.getByText('Identité Git enregistrée.')).toBeVisible()
  expect(readFileSync(join(run.userData, 'gitconfig'), 'utf-8')).toContain('alice@example.org')

  // A server: added from here, tested (nothing listens there), removed
  await page.getByRole('button', { name: 'Ajouter un serveur' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom', { exact: true }).fill('Banc d\'essai')
  await dialog.getByLabel('Hôte / IP').fill('127.0.0.1')
  await dialog.getByLabel('Port', { exact: true }).fill('1')
  await dialog.getByLabel("Nom d'utilisateur").fill('test')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('test@127.0.0.1')).toBeVisible()
  await page.getByRole('button', { name: 'Tester Banc d\'essai' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Échec' })).toBeVisible({ timeout: 30_000 })
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: 'Retirer Banc d\'essai' }).click()
  await expect(page.getByText('Aucun serveur', { exact: true })).toBeVisible()
})
