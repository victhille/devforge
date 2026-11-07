import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, openProjectTab, type Launched } from './launch'
import { pullLink } from './pull'

/** v4.1 lot 4: an MPD drawn by hand, in a project with no database — tables from the bar, columns, keys, removed */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a project without a database gets its MPD table by table', async () => {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'blog')
      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), '{"name":"blog"}')
      writeFileSync(join(project, '.env'), 'DATABASE_URL=postgresql://app:pw@127.0.0.1:5432/blog\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Blog', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/p1')
  await openProjectTab(page, 'Modélisation')
  await expect(page.getByRole('button', { name: 'Créer depuis la base' })).toHaveCount(0)

  // A new, empty MPD: no database needed
  await page.getByRole('combobox', { name: 'Nouveau modèle' }).selectOption({ label: 'Modèle physique' })
  const dialog = page.getByRole('dialog', { name: 'Nouveau : Modèle physique' })
  await expect(dialog.getByRole('combobox', { name: 'Connexion' })).toHaveValue('')
  await expect(dialog.getByRole('combobox', { name: 'Connexion' }).locator('option').first()).toHaveText('Aucune : un MPD vierge')
  await expect(dialog.getByText(/Un MPD vide, sur le moteur du projet/)).toBeVisible()
  await dialog.getByLabel('Nom').fill('Blog')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  await expect(page).toHaveURL(/file=blog\.mpd\.json.*tab=mpd/)
  await expect(page.getByText(/Pas encore de table : glisse « Table »/)).toBeVisible()

  // Tables from the bar: a click, then a drag where it is let go
  const bar = page.getByRole('toolbar', { name: 'Palette' })
  const canvas = page.getByTestId('mpd-canvas')
  await bar.getByRole('button', { name: 'Table', exact: true }).click()
  // A spot inside the canvas whatever the window's size (the CI's is smaller)
  const area = (await canvas.boundingBox())!
  await bar.getByRole('button', { name: 'Table', exact: true }).dragTo(canvas, { targetPosition: { x: Math.round(area.width * 0.65), y: Math.round(area.height * 0.2) } })
  await expect(canvas.locator('[data-table]')).toHaveCount(2)

  // The table picked: renamed, a column added, made part of the key, another one removed
  const panel = page.getByRole('complementary', { name: 'Table' })
  await panel.getByLabel('Nom de la table').fill('article')
  await panel.getByRole('button', { name: 'Colonne', exact: true }).click()
  await panel.getByRole('button', { name: 'Colonne', exact: true }).click()
  await panel.getByLabel('Nom de la colonne').nth(1).fill('titre')
  await panel.getByRole('button', { name: 'Retirer la colonne column_3' }).click()
  await expect(panel.getByLabel('Nom de la colonne')).toHaveCount(2)

  // The other table, and a foreign key pulled from article to it
  await canvas.locator('[data-table="table_1"]').locator('div').first().click()
  await panel.getByLabel('Nom de la table').fill('auteur')
  await pullLink(page, 'article', canvas.locator('[data-table="auteur"]'), 'left')
  await expect(canvas.locator('[data-table="article"]')).toContainText('auteur_id')

  // Saved in the project: two tables, on the engine of its .env
  const file = join(project, 'conception', 'blog.mpd.json')
  await expect.poll(() => { const m = JSON.parse(readFileSync(file, 'utf-8')).mpd; return [m.engine, m.tables.map((t: { name: string }) => t.name).sort()] }).toEqual(['postgres', ['article', 'auteur']])

  // auteur removed: its key in article goes with it
  await canvas.locator('[data-table="auteur"]').locator('div').first().click()
  await page.keyboard.press('Delete')
  await expect(canvas.locator('[data-table]')).toHaveCount(1)
  await expect(canvas.locator('[data-table="article"]')).not.toContainText('auteur_id')

  // The SQL of what was drawn
  await page.getByRole('navigation', { name: 'Étapes du modèle' }).getByRole('button', { name: 'SQL' }).click()
  await expect(page.getByText(/CREATE TABLE "?article"?/)).toBeVisible()
})
