import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { settledAxeIssues as settledAxe } from './axe'
import { goTo, launch, openProjectTab, type Launched } from './launch'

/** v4.2 lot 3: an MPD drawn by hand gets its MCD in one click, and the two stay tied; the model lists follow what is written meanwhile */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('« Déduire le MCD » writes the MCD next to the MPD, opens it, and ties the MPD to it', async () => {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'boutique')
      mkdirSync(join(project, 'conception'), { recursive: true })
      const col = (id: string, name: string, extra: object = {}) => ({ id, name, type: 'int', ...extra })
      writeFileSync(join(project, 'conception', 'boutique.mpd.json'), JSON.stringify({ v: 1, kind: 'mpd', name: 'Boutique', updatedAt: '2026-11-01T00:00:00.000Z', mpd: {
        engine: 'postgres', tables: [
          { id: 'tC', name: 'client', x: 60, y: 60, indexes: [], columns: [col('c1', 'id', { pk: true, auto: true })] },
          { id: 'tO', name: 'commande', x: 420, y: 60, indexes: [], columns: [col('o1', 'id', { pk: true, auto: true }), col('o2', 'client_id', { ref: { table: 'tC', column: 'c1' } })] }
        ] } }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Boutique', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=boutique.mpd.json&tab=mpd`)

  // No MCD tied: the banner says so, and offers to work it out
  await expect(page.getByText('Pas de MCD lié : ce MPD ne se met pas à jour.')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: 'Déduire le MCD' }).click()

  // The MCD, opened: its two entities and the association of the foreign key
  await expect(page).toHaveURL(/file=boutique\.mcd\.json.*tab=mcd/)
  await expect(page.locator('[data-entity="CLIENT"]')).toBeVisible()
  await expect(page.locator('[data-entity="COMMANDE"]')).toBeVisible()
  await expect(page.locator('[data-association="COMMANDE_CLIENT"]')).toBeVisible()
  expect(existsSync(join(project, 'conception', 'boutique.mcd.json'))).toBe(true)

  // Back on the MPD: tied, its tables where the hand put them
  await page.getByRole('navigation', { name: 'Étapes du modèle' }).getByRole('button', { name: 'MPD' }).click()
  await expect(page.getByTestId('mpd-canvas').locator('[data-table="commande"]')).toBeVisible()
  await expect(page.getByText('Pas de MCD lié : ce MPD ne se met pas à jour.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Déduire le MCD' })).toHaveCount(0)
  const mpd = JSON.parse(readFileSync(join(project, 'conception', 'boutique.mpd.json'), 'utf-8')).mpd
  expect(mpd.source).toBe('boutique.mcd.json')
  expect(mpd.tables.find((t: { name: string }) => t.name === 'commande')).toMatchObject({ x: 420, y: 60 })
})

test('a model written while the lists are open (as Forgy does) shows up at once, and goes once removed', async () => {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'atelier')
      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), '{"name":"atelier"}')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Atelier', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  // The model's card, its file in its tooltip
  const card = page.getByTitle('conception/connexion.sequence.json')

  // The project's Modeling tab, open while the main process writes a model (Forgy's way: not from this page)
  await goTo(page, '/project/p1')
  await openProjectTab(page, 'Modélisation')
  await expect(card).toHaveCount(0)
  expect(await page.evaluate(p => window.devforge.modeling.create(p, 'sequence', 'Connexion'), project)).toBe('connexion.sequence.json')
  await expect(card).toBeVisible()

  // The Modeling page too: removed, gone without leaving it
  await goTo(page, '/modeling')
  await expect(card).toBeVisible()
  await page.evaluate(p => window.devforge.modeling.remove(p, 'connexion.sequence.json'), project)
  await expect(card).toHaveCount(0)
})
