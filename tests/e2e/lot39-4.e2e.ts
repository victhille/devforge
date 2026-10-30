import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { DEFAULT_NAMING, generateMpd, mpdSql } from '../../src/shared/lib/mpd'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { shop } from '../shopMcd'

/** v3.9 lot 4: the MPD against its linked database — differences, the catch-up script, the import */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('the linked database: its differences, the script applied, then a database imported', async () => {
  const SQL = await initSqlJs()
  const mpd = generateMpd(shop(), DEFAULT_NAMING, 'sqlite', null, 'boutique.mcd.json')
  let project = '', file = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'shop')
      mkdirSync(join(project, 'conception'), { recursive: true })
      writeFileSync(join(project, 'conception', 'boutique.mcd.json'), JSON.stringify({ v: 1, kind: 'mcd', name: 'Boutique', updatedAt: '2026-10-01T10:00:00.000Z', mcd: shop() }))
      writeFileSync(join(project, 'conception', 'boutique.mpd.json'), JSON.stringify({ v: 1, kind: 'mpd', name: 'Boutique', updatedAt: '2026-10-01T10:00:00.000Z', mpd }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 's', name: 'shop', path: project, framework: 'other', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
      // The development database: no "avis" yet, an old column and a table the MPD does not know
      const db = new SQL.Database()
      db.run(mpdSql({ ...mpd, tables: mpd.tables.filter(t => t.name !== 'avis') }))
      db.run('ALTER TABLE produit ADD COLUMN vieux TEXT; CREATE TABLE trace (id INTEGER PRIMARY KEY, quoi TEXT)')
      file = join(dir, 'shop.sqlite')
      writeFileSync(file, Buffer.from(db.export()))
      writeFileSync(join(dir, 'databases.json'), JSON.stringify([{ id: 'dev', name: 'shop_dev', type: 'sqlite', file, color: '#5B9BFF' }]))
    }
  })
  const { page, app } = run
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900))
  await goTo(page, '/modeling')
  const chain = page.getByRole('region', { name: 'La chaîne du projet' })
  await expect(chain).toContainText('Aucune base liée')

  // Linked: three differences, the missing table marked on the drawing
  await chain.locator('[data-step="mpd"]').click()
  const panel = page.getByRole('region', { name: 'Base liée' })
  await panel.getByRole('combobox', { name: 'Base liée' }).selectOption('dev')
  await expect(panel.getByRole('status')).toHaveText('Écart avec shop_dev · ▲ 3 différence(s)')
  await expect(panel).toContainText('avis existe dans le MPD, pas dans la base : CREATE TABLE')
  await expect(panel).toContainText('produit.vieux n’est que dans la base (TEXT)')
  await expect(page.getByTestId('mpd-canvas').locator('[data-table="avis"]')).toContainText('absente de la base')
  await expect.poll(() => JSON.parse(readFileSync(join(project, 'conception', 'boutique.mpd.json'), 'utf-8')).mpd.connection, { timeout: 10_000 }).toBe('dev')
  expect(await settledAxeIssues(page)).toEqual([])

  // The script: what loses data in red, applied once accepted
  await panel.getByRole('button', { name: 'Voir le script' }).click()
  const dialog = page.getByRole('dialog', { name: 'Script pour shop_dev' })
  const script = dialog.getByTestId('diff-script')
  await expect(script).toContainText('CREATE TABLE avis (')
  await expect(script).toContainText('ALTER TABLE produit DROP COLUMN vieux;')
  await expect(script).toContainText('DROP TABLE trace;')
  await expect(dialog).toContainText('Des données seront perdues (en rouge) : produit.vieux, trace.')
  const apply = dialog.getByRole('button', { name: 'Appliquer à shop_dev' })
  await expect(apply).toBeDisabled()
  await dialog.getByRole('checkbox', { name: /J’ai compris/ }).check()
  expect(await settledAxeIssues(page)).toEqual([])
  await apply.click()
  await expect(dialog).toBeHidden()
  await expect(panel.getByRole('status')).toHaveText('● Identique à shop_dev')
  const after = new SQL.Database(readFileSync(file))
  expect(after.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")[0].values.flat())
    .toEqual(['adresse', 'avis', 'categorie', 'client', 'commande', 'commande_produit', 'produit'])
  after.close()

  // Back on the page: the linked database is up to date; then a database imported as a new model
  await page.getByRole('button', { name: 'Modélisation' }).click()
  await expect(chain.locator('[data-step="base"]')).toContainText('● À jour')
  await page.getByRole('region', { name: 'Créer un modèle' }).getByRole('button', { name: /Depuis une base/ }).click()
  const importing = page.getByRole('dialog', { name: 'Importer depuis une base' })
  await importing.getByLabel('Nom').fill('Reprise')
  await importing.getByRole('button', { name: 'Importer' }).click()
  await expect(page.getByRole('heading', { name: 'Reprise' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Base liée' }).getByRole('status')).toHaveText('● Identique à shop_dev')
  await page.getByRole('navigation', { name: 'Étapes du modèle' }).getByRole('button', { name: 'MLD' }).click()
  await expect(page.locator('[data-relation="COMMANDE_PRODUIT"]')).toContainText('#id_commande, #id_produit, quantite')
  const mcd = JSON.parse(readFileSync(join(project, 'conception', 'reprise.mcd.json'), 'utf-8')).mcd
  expect(mcd.entities).toHaveLength(6)
  expect(mcd.associations).toHaveLength(5)
})
