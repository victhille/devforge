import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { pullLink } from './pull'

/** v3.9 lot 2: the Modeling page and the MCD editor, saved in the project's conception/ folder */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('an MCD drawn, checked and saved in the project, then found again in the list', async () => {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'shop')
      mkdirSync(project, { recursive: true })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 's', name: 'shop', path: project, framework: 'other', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page, app } = run
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900))
  await goTo(page, '/modeling')
  await expect(page.locator('main h1')).toHaveText('Modélisation')
  await expect(page.getByText('Pas encore de modèle dans shop.')).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  // Created from its tile: an empty MCD, in conception/
  await page.getByRole('region', { name: 'Créer un modèle' }).getByRole('button', { name: /Modèle conceptuel/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouveau : Modèle conceptuel' })
  await dialog.getByLabel('Nom').fill('Boutique')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('heading', { name: 'Boutique' })).toBeVisible()
  const file = join(project, 'conception', 'boutique.mcd.json')
  expect(existsSync(file)).toBe(true)
  await expect(page.getByText(/Un MCD vide/)).toBeVisible()

  // Two entities and an association, from the palette
  const palette = page.getByRole('complementary', { name: 'Palette' })
  await palette.getByRole('button', { name: 'Entité', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Élément choisi' })
  await panel.getByLabel('Nom', { exact: true }).fill('Client')
  await panel.getByRole('button', { name: 'Attribut', exact: true }).click()
  await panel.getByLabel('Nom de l’attribut').last().fill('email')
  await palette.getByRole('button', { name: 'Entité', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Commande')
  await palette.getByRole('button', { name: 'Association', exact: true }).click()
  await panel.getByLabel('Nom', { exact: true }).fill('Passer')

  // Two legs: a line pulled from each entity's point onto the association
  for (const name of ['Client', 'Commande']) await pullLink(page, name, page.locator('[data-association="Passer"]'))
  // A click on a cardinality: the next one
  const leg = page.getByRole('button', { name: 'Cardinalité de Commande dans Passer : 0,n' })
  await leg.click()
  await expect(page.getByRole('button', { name: 'Cardinalité de Commande dans Passer : 1,n' })).toBeVisible()
  await page.getByRole('button', { name: 'Cardinalité de Commande dans Passer : 1,n' }).click()
  await page.getByRole('button', { name: 'Cardinalité de Commande dans Passer : 0,1' }).click()
  await expect(page.getByRole('button', { name: 'Cardinalité de Commande dans Passer : 1,1' })).toBeVisible()

  // Saved in the project's file
  await expect.poll(() => {
    const m = JSON.parse(readFileSync(file, 'utf-8')).mcd
    return [m.entities.map((e: { name: string }) => e.name).join(','), m.associations[0]?.name, m.links.map((l: { card: string }) => l.card).join(',')]
  }, { timeout: 10_000 }).toEqual(['Client,Commande', 'Passer', '0,n,1,1'])
  await expect(page.getByRole('status').filter({ hasText: 'Enregistré · conception/boutique.mcd.json' })).toBeVisible()

  // The check: nothing wrong; then an identifier taken away is reported
  await page.getByRole('button', { name: /^Vérifier/ }).click()
  await expect(panel).toContainText('Rien à signaler')
  await page.locator('[data-entity="Client"]').click()
  await panel.getByRole('checkbox', { name: /fait partie de l’identifiant/ }).first().uncheck()
  await page.getByRole('button', { name: /^Vérifier/ }).click()
  await expect(panel).toContainText('Client n’a pas d’identifiant')
  // Undone: sound again
  await page.keyboard.press('Control+z')
  await expect(panel).toContainText('Rien à signaler')
  expect(await settledAxeIssues(page)).toEqual([])

  // Back to the list: the model, its counts and its file
  await page.getByRole('button', { name: 'Modélisation' }).click()
  const card = page.getByRole('region', { name: 'Modèles du projet' }).getByRole('listitem')
  await expect(card).toContainText('Boutique')
  await expect(card).toContainText('2 entité(s) · 1 association(s)')
  await expect(card).toContainText('conception/boutique.mcd.json')
  await expect(page.getByRole('region', { name: 'La chaîne du projet' })).toContainText('● À jour')
})
