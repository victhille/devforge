import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_NAMING, generateMpd } from '../../src/shared/lib/mpd'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { pullLink, pullToEmpty } from './pull'
import { shop } from '../shopMcd'

/** v3.9: links pulled from the parts' points, the palette dragged onto the canvas (MCD, flowchart, MPD) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('parts dragged from the palette, links pulled from their points, a foreign key pulled between tables', async () => {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'shop')
      mkdirSync(join(project, 'conception'), { recursive: true })
      const mpd = generateMpd(shop(), DEFAULT_NAMING, 'postgres', null, 'boutique.mcd.json')
      writeFileSync(join(project, 'conception', 'boutique.mcd.json'), JSON.stringify({ v: 1, kind: 'mcd', name: 'Boutique', updatedAt: '2026-10-01T10:00:00.000Z', mcd: shop() }))
      writeFileSync(join(project, 'conception', 'boutique.mpd.json'), JSON.stringify({ v: 1, kind: 'mpd', name: 'Boutique', updatedAt: '2026-10-01T10:00:00.000Z', mpd }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 's', name: 'shop', path: project, framework: 'other', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page, app } = run
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900))
  await goTo(page, '/modeling')
  const create = page.getByRole('region', { name: 'Créer un modèle' })

  // An MCD: two entities dragged from the palette onto the canvas
  await create.getByRole('button', { name: /Modèle conceptuel/ }).click()
  await page.getByRole('dialog').getByLabel('Nom').fill('Stock')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  const palette = page.getByRole('complementary', { name: 'Palette' })
  const panel = page.getByRole('complementary', { name: 'Élément choisi' })
  const canvas = page.getByTestId('mcd-canvas')
  await palette.getByRole('button', { name: 'Entité', exact: true }).dragTo(canvas, { targetPosition: { x: 200, y: 200 } })
  await panel.getByLabel('Nom', { exact: true }).fill('Client')
  await palette.getByRole('button', { name: 'Entité', exact: true }).dragTo(canvas, { targetPosition: { x: 650, y: 220 } })
  await panel.getByLabel('Nom', { exact: true }).fill('Produit')

  // Entity onto entity: an association between them, with both legs
  await pullLink(page, 'Client', page.locator('[data-entity="Produit"]'))
  await expect(panel.getByLabel('Nom', { exact: true })).toHaveValue('ASSOCIATION')
  await panel.getByLabel('Nom', { exact: true }).fill('Acheter')
  // Let go on empty space: a new entity there, joined by a new association
  await pullToEmpty(page, 'Produit', 'bottom', 0, 260)
  const file = join(project, 'conception', 'stock.mcd.json')
  await expect.poll(() => {
    const m = JSON.parse(readFileSync(file, 'utf-8')).mcd
    return [m.entities.length, m.associations.length, m.links.length, m.associations[0]?.name]
  }, { timeout: 10_000 }).toEqual([3, 2, 4, 'Acheter'])
  // A slip (let go next to the point) makes nothing
  await pullToEmpty(page, 'Client', 'top', 0, -15)
  await page.waitForTimeout(700)
  expect(JSON.parse(readFileSync(file, 'utf-8')).mcd.entities.length).toBe(3)
  expect(await settledAxeIssues(page)).toEqual([])

  // A flowchart: a start dropped, then a step pulled out of it into empty space
  await page.getByRole('button', { name: 'Modélisation' }).click()
  await create.getByRole('button', { name: /Logigramme/ }).click()
  await page.getByRole('dialog').getByLabel('Nom').fill('Paiement')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await palette.getByRole('button', { name: 'Début', exact: true }).dragTo(page.getByTestId('diagram-canvas'), { targetPosition: { x: 300, y: 120 } })
  await pullToEmpty(page, 'Début', 'bottom', 0, 160)
  await expect.poll(() => {
    const d = JSON.parse(readFileSync(join(project, 'conception', 'paiement.flow.json'), 'utf-8')).diagram
    return [d.nodes.map((n: { type: string }) => n.type).join(','), d.edges.map((e: { type: string }) => e.type).join(',')]
  }, { timeout: 10_000 }).toEqual(['start,step', 'flow'])

  // The MPD: a line from adresse onto categorie adds the foreign key
  await page.getByRole('button', { name: 'Modélisation' }).click()
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=boutique.mpd.json`)
  const mpdCanvas = page.getByTestId('mpd-canvas')
  await expect(mpdCanvas.locator('[data-table="adresse"]')).toBeVisible()
  await pullLink(page, 'adresse', mpdCanvas.locator('[data-table="categorie"]'))
  await expect(page.getByText('Clé étrangère adresse.categorie_id ajoutée')).toBeVisible()
  await expect(mpdCanvas.locator('[data-table="adresse"]')).toContainText('categorie_id')
  await expect.poll(() => {
    const m = JSON.parse(readFileSync(join(project, 'conception', 'boutique.mpd.json'), 'utf-8')).mpd
    const adresse = m.tables.find((t: { name: string }) => t.name === 'adresse')
    const categorie = m.tables.find((t: { name: string }) => t.name === 'categorie')
    return adresse.columns.find((c: { name: string }) => c.name === 'categorie_id')?.ref?.table === categorie.id
  }, { timeout: 10_000 }).toBe(true)
})
