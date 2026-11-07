import { expect, test, type Locator, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v4.1 lot 3: the floating bar — the selection cursor picks a zone, its parts move together; the hand moves the view */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const attr = (id: string, name: string, identifier = false) => ({ id, name, type: 'int', ...(identifier ? { identifier: true } : {}) })
const box = async (l: Locator) => (await l.boundingBox())!
/** A drag on the page, from one point to another, as a hand would */
async function dragFrom(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, opts: { shift?: boolean } = {}) {
  if (opts.shift) await page.keyboard.down('Shift')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  await page.mouse.up()
  if (opts.shift) await page.keyboard.up('Shift')
}

test('MCD: a zone picks two entities, they move together, the hand moves the view', async () => {
  let file = ''
  run = await launch({
    seed: dir => {
      const project = join(dir, 'shop')
      mkdirSync(join(project, 'conception'), { recursive: true })
      file = join(project, 'conception', 'shop.mcd.json')
      writeFileSync(file, JSON.stringify({ v: 1, kind: 'mcd', name: 'Shop', updatedAt: '2026-11-01T00:00:00.000Z', mcd: {
        entities: [
          { id: 'a', name: 'CLIENT', x: 100, y: 100, attributes: [attr('a1', 'id_client', true)] },
          { id: 'b', name: 'COMMANDE', x: 380, y: 100, attributes: [attr('b1', 'id_commande', true)] },
          { id: 'c', name: 'PRODUIT', x: 100, y: 380, attributes: [attr('c1', 'id_produit', true)] }
        ], associations: [], links: [], notes: [] } }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Shop', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  const project = file.replace(/[\\/]conception[\\/]shop\.mcd\.json$/, '')
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=shop.mcd.json`)

  // The bar: the selection cursor first, then the parts
  const bar = page.getByRole('toolbar', { name: 'Palette' })
  await expect(bar.getByRole('radio', { name: 'Sélection (V)' })).toHaveAttribute('aria-checked', 'true')
  await expect(bar.getByRole('button', { name: 'Entité', exact: true })).toBeVisible()
  const [client, commande, produit] = ['CLIENT', 'COMMANDE', 'PRODUIT'].map(n => page.locator(`[data-entity="${n}"]`))

  // A zone around CLIENT and COMMANDE, from the background
  const a = await box(client), b = await box(commande)
  await dragFrom(page, { x: a.x - 20, y: a.y - 20 }, { x: b.x + b.width + 20, y: b.y + b.height + 20 })
  const panel = page.getByRole('complementary', { name: 'Élément choisi' })
  await expect(panel.getByRole('status')).toHaveText('2 éléments sélectionnés')
  await expect(client).toHaveAttribute('data-picked', 'true')
  await expect(produit).not.toHaveAttribute('data-picked', 'true')

  // Moved together: the same distance each, PRODUIT stays
  const before = await box(produit)
  // By the middle of the box (its points pull links)
  await dragFrom(page, { x: a.x + a.width / 2, y: a.y + a.height / 2 }, { x: a.x + a.width / 2 + 120, y: a.y + a.height / 2 + 60 })
  const pos = () => Object.fromEntries(JSON.parse(readFileSync(file, 'utf-8')).mcd.entities.map((e: { name: string; x: number; y: number }) => [e.name, [e.x, e.y]]))
  await expect.poll(() => { const p = pos(); return [p.CLIENT[0] - 100 === p.COMMANDE[0] - 380, p.CLIENT[0] > 100, p.PRODUIT[0]] }).toEqual([true, true, 100])
  expect((await box(produit)).x).toBeCloseTo(before.x, 0)

  // One step back, both at once
  await page.keyboard.press('Control+z')
  await expect.poll(() => pos().CLIENT).toEqual([100, 100])
  expect(pos().COMMANDE).toEqual([380, 100])

  // Shift+click adds PRODUIT; Escape lets them all go
  await produit.click({ modifiers: ['Shift'] })
  await expect(panel.getByRole('status')).toHaveText('3 éléments sélectionnés')
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-picked]')).toHaveCount(0)

  // The hand: a drag on the background moves the view, picks nothing
  await bar.getByRole('radio', { name: 'Main (H)' }).click()
  const seen = await box(client)
  const canvas = await box(page.getByTestId('mcd-canvas'))
  await dragFrom(page, { x: canvas.x + canvas.width - 60, y: canvas.y + 60 }, { x: canvas.x + canvas.width - 160, y: canvas.y + 120 })
  expect((await box(client)).x).toBeCloseTo(seen.x - 100, 0)
  await expect(page.locator('[data-picked]')).toHaveCount(0)
  await expect(page.getByTestId('select-zone')).toHaveCount(0)
  // V: the selection cursor again, kept for the next editor
  await page.keyboard.press('v')
  await expect(bar.getByRole('radio', { name: 'Sélection (V)' })).toHaveAttribute('aria-checked', 'true')

  // Ctrl+A then Delete: all gone; Ctrl+Z: all back
  await page.getByTestId('mcd-canvas').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('Control+a')
  await expect(panel.getByRole('status')).toHaveText('3 éléments sélectionnés')
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-entity]')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-entity]')).toHaveCount(3)
})

test('a flowchart and an MPD: the same bar, a zone, a move together', async () => {
  let dir = ''
  run = await launch({
    seed: d => {
      dir = d
      const project = join(d, 'flow')
      mkdirSync(join(project, 'conception'), { recursive: true })
      writeFileSync(join(project, 'conception', 'flux.flow.json'), JSON.stringify({ v: 1, kind: 'flow', name: 'Flux', updatedAt: '2026-11-01T00:00:00.000Z', diagram: {
        nodes: [{ id: 'n1', type: 'start', name: 'Début', x: 100, y: 100 }, { id: 'n2', type: 'step', name: 'Valider', x: 100, y: 260 }, { id: 'n3', type: 'end', name: 'Fin', x: 500, y: 460 }],
        edges: [], notes: [] } }))
      const col = (id: string, name: string, pk = false) => ({ id, name, type: 'int', ...(pk ? { pk: true } : {}) })
      writeFileSync(join(project, 'conception', 'base.mpd.json'), JSON.stringify({ v: 1, kind: 'mpd', name: 'Base', updatedAt: '2026-11-01T00:00:00.000Z', mpd: {
        engine: 'postgres', tables: [
          { id: 't1', name: 'client', x: 80, y: 80, columns: [col('c1', 'id', true)] },
          { id: 't2', name: 'commande', x: 380, y: 80, columns: [col('c2', 'id', true)] },
          { id: 't3', name: 'produit', x: 80, y: 420, columns: [col('c3', 'id', true)] }
        ] } }))
      writeFileSync(join(d, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Flow', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  const project = join(dir, 'flow')

  // The flowchart: its parts in the bar, a zone around two of them
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=flux.flow.json`)
  const bar = page.getByRole('toolbar', { name: 'Palette' })
  await expect(bar.getByRole('button', { name: 'Décision', exact: true })).toBeVisible()
  const start = page.locator('[data-node="Début"]'), step = page.locator('[data-node="Valider"]'), end = page.locator('[data-node="Fin"]')
  const s1 = await box(start), s2 = await box(step)
  await dragFrom(page, { x: s1.x - 20, y: s1.y - 20 }, { x: s2.x + s2.width + 20, y: s2.y + s2.height + 20 })
  await expect(page.getByRole('complementary', { name: 'Élément' }).getByRole('status')).toHaveText('2 éléments sélectionnés')
  const fin = await box(end)
  await dragFrom(page, { x: s1.x + s1.width / 2, y: s1.y + s1.height / 2 }, { x: s1.x + s1.width / 2 + 90, y: s1.y + s1.height / 2 })
  await expect.poll(async () => (await box(step)).x).toBeCloseTo(s2.x + 90, 0)
  expect((await box(end)).x).toBeCloseTo(fin.x, 0)

  // The MPD: the bar with the cursors only, a zone, the tables moved together
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=base.mpd.json&tab=mpd`)
  const mpd = page.getByTestId('mpd-canvas')
  await expect(page.getByRole('toolbar', { name: 'Palette' }).getByRole('radio', { name: 'Main (H)' })).toBeVisible()
  const [t1, t2, t3] = ['client', 'commande', 'produit'].map(n => mpd.locator(`[data-table="${n}"]`))
  const b1 = await box(t1), b2 = await box(t2), b3 = await box(t3)
  await dragFrom(page, { x: b1.x - 20, y: b1.y - 20 }, { x: b2.x + b2.width + 20, y: b2.y + b2.height + 20 })
  await expect(t1).toHaveAttribute('data-picked', 'true')
  await expect(t2).toHaveAttribute('data-picked', 'true')
  await dragFrom(page, { x: b2.x + 40, y: b2.y + 10 }, { x: b2.x + 40, y: b2.y + 110 })
  await expect.poll(async () => (await box(t1)).y).toBeCloseTo(b1.y + 100, 0)
  expect((await box(t3)).y).toBeCloseTo(b3.y, 0)
})
