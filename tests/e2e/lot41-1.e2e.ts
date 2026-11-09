import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, openProjectTab, type Launched } from './launch'

/** v4.1 lot 1: the project's Modeling tab — its models, the schema made from its database step by step, Forgy */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

async function start(withDb: boolean) {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run(`CREATE TABLE client (id INTEGER PRIMARY KEY, email TEXT NOT NULL);
    CREATE TABLE commande (id INTEGER PRIMARY KEY, client_id INTEGER NOT NULL REFERENCES client(id), passee_le TEXT);
    CREATE TABLE produit (id INTEGER PRIMARY KEY, libelle TEXT);`)
  run = await launch({
    seed: dir => {
      const project = join(dir, 'shop')
      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), '{"name":"shop"}')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'Shop', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      if (withDb) {
        writeFileSync(join(project, 'shop.sqlite'), Buffer.from(db.export()))
        writeFileSync(join(dir, 'databases.json'), JSON.stringify([{ id: 'lite', name: 'Shop SQLite', type: 'sqlite', file: join(project, 'shop.sqlite'), color: '#5B9BFF' }]))
      }
    }
  })
}

test('a project with a database: its MCD and MPD made in one click, each step shown, then opened', async () => {
  await start(true)
  const { page } = run
  await goTo(page, '/project/p1')
  await openProjectTab(page, 'Modélisation')
  await expect(page.getByText(/« Créer depuis la base » lit la base du projet/)).toBeVisible()

  await page.getByRole('button', { name: 'Créer depuis la base' }).click()
  const progress = page.getByRole('status', { name: 'Création du schéma' })
  await expect(progress.getByText('Schéma créé')).toBeVisible()
  await expect(progress.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  for (const [step, text] of [['connect', 'Connexion à Shop SQLite'], ['read', '3 table(s) lue(s)'], ['mcd', 'MCD déduit des tables'], ['mpd', 'MPD de 3 table(s), lié à la base'], ['write', 'Écriture dans conception/']]) {
    await expect(progress.locator(`[data-step="${step}"]`)).toHaveText(text)
    await expect(progress.locator(`[data-step="${step}"]`)).toHaveAttribute('data-state', 'done')
  }
  await expect(page.getByText('MCD et MPD créés depuis Shop SQLite (3 tables)')).toBeVisible()

  // The two models, listed in the tab
  // Their file on hover
  await expect(page.getByTitle('conception/shop.mcd.json')).toBeVisible()
  await expect(page.getByTitle('conception/shop.mpd.json')).toBeVisible()
  await expect(page.getByText('3 entité(s) · 1 association(s)')).toBeVisible()

  await page.getByRole('button', { name: 'Ouvrir le MCD' }).click()
  await expect(page).toHaveURL(/#\/model\?.*file=shop\.mcd\.json.*&from=p1/)
  await expect(page.getByText('CLIENT', { exact: true }).first()).toBeVisible()

  // The crumbs: the project, the Modeling page, this model; the project leads back to its tab, MLD and MPD keep the way
  const crumbs = page.getByRole('navigation', { name: 'Fil d’Ariane' })
  await expect(crumbs.getByRole('listitem')).toHaveText(['Shop', 'Modélisation', 'Shop'])
  await page.getByRole('navigation', { name: 'Étapes du modèle' }).getByRole('button', { name: 'MPD' }).click()
  await expect(page).toHaveURL(/tab=mpd.*&from=p1/)
  await crumbs.getByRole('button', { name: 'Shop' }).click()
  await expect(page).toHaveURL(/#\/project\/p1\?tab=modeling/)
  await expect(page.getByRole('tab', { name: 'Modélisation' })).toHaveAttribute('aria-selected', 'true')

  // From the model's card too, and the arrow goes back the same way
  await page.getByRole('button', { name: 'Ouvrir Shop' }).last().click()
  await expect(page).toHaveURL(/&from=p1/)
  await page.getByRole('button', { name: 'Page précédente' }).click()
  await expect(page).toHaveURL(/#\/project\/p1\?tab=modeling/)
})

test('a project without a database: by hand, or Forgy from a description', async () => {
  await start(false)
  const { page } = run
  await goTo(page, '/project/p1')
  await openProjectTab(page, 'Modélisation')
  await expect(page.getByRole('button', { name: 'Créer depuis la base' })).toHaveCount(0)
  await expect(page.getByText(/Pas encore de modèle\. Crée un MCD à la main/)).toBeVisible()

  // Forgy: nothing to send until something is described
  const forgy = page.getByRole('button', { name: 'Envoyer à Forgy' })
  await expect(forgy).toBeDisabled()
  await page.getByRole('textbox', { name: 'Demander à Forgy' }).fill('une bibliothèque : des auteurs écrivent des livres')
  await expect(forgy).toBeEnabled()

  // By hand: a new MCD, named, opens in the editor
  await page.getByRole('combobox', { name: 'Nouveau modèle' }).selectOption({ label: 'Modèle conceptuel' })
  await page.getByRole('dialog').getByRole('textbox').fill('Bibliothèque')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await expect(page).toHaveURL(/#\/model\?.*file=bibliotheque\.mcd\.json/)
})
