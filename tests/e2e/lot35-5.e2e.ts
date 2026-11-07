import { expect, test } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5 lot 5: a command added to the docs, checked and completed while typed */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a command is completed, checked, saved in its reference and found by the search', async () => {
  run = await launch()
  const { page, userData } = run
  await goTo(page, '/docs')
  await page.getByRole('button', { name: 'Ajouter une commande' }).click()

  const dialog = page.getByRole('dialog', { name: 'Ajouter une commande' })
  const cmd = dialog.getByRole('combobox', { name: 'Commande' })
  // Completion: the page's own commands first, then git's sub-commands; arrows and Enter pick one
  await cmd.fill('git ch')
  await expect(dialog.getByRole('option', { name: 'git checkout', exact: true })).toBeVisible()
  const first = await dialog.getByRole('option').first().textContent()
  await cmd.press('ArrowDown')
  await cmd.press('Enter')
  await expect(cmd).toHaveValue(first!)
  await cmd.fill('git ch')
  await dialog.getByRole('option', { name: 'git checkout', exact: true }).click()
  await expect(cmd).toHaveValue('git checkout')
  await cmd.fill('git switch -c feature/')
  // git is on the CI's PATH: found
  await expect(dialog.getByRole('status')).toContainText('Trouvée sur ce PC')
  await dialog.getByLabel('Description').fill('Nouvelle branche de fonctionnalité')
  await dialog.locator('select').selectOption({ label: 'Git' })
  expect(await settledAxe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()

  // In Git's "My commands", and in its search
  await expect(page.getByRole('heading', { name: 'Git' })).toBeVisible()
  await expect(page.getByText('Mes commandes')).toBeVisible()
  await page.getByLabel('Rechercher dans Git…').fill('fonctionnalité')
  await expect(page.getByText('git switch -c feature/')).toBeVisible()
  expect(JSON.parse(readFileSync(join(userData, 'doc-commands.json'), 'utf-8'))).toEqual([expect.objectContaining({ cmd: 'git switch -c feature/', category: 'Git' })])

  // A program this PC lacks can still be saved, in a new category
  await page.getByRole('button', { name: 'Ajouter une commande' }).click()
  await cmd.fill('surely-not-installed deploy --prod')
  await expect(dialog.getByRole('status')).toContainText("n'est pas sur ce PC")
  await dialog.locator('select').selectOption({ label: 'Nouvelle catégorie…' })
  await dialog.getByLabel('Nom de la catégorie').fill('VPS')
  await dialog.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByRole('heading', { name: 'VPS' })).toBeVisible()
  await expect(page.getByText('surely-not-installed deploy --prod')).toBeVisible()
})
