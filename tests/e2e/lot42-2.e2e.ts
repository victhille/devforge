import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { settledAxeIssues as settledAxe } from './axe'
import { goTo, launch, type Launched } from './launch'

/** v4.2 lot 2: the selection lined up and spread out; parts copied, pasted (in another model too), duplicated */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const attr = (id: string, name: string, identifier = false) => ({ id, name, type: 'int', ...(identifier ? { identifier: true } : {}) })
const col = (id: string, name: string, extra: object = {}) => ({ id, name, type: 'int', ...extra })

test('MCD: aligned, spread out, copied with its leg, pasted and duplicated', async () => {
  let file = ''
  run = await launch({
    seed: dir => {
      const project = join(dir, 'shop')
      mkdirSync(join(project, 'conception'), { recursive: true })
      file = join(project, 'conception', 'shop.mcd.json')
      writeFileSync(file, JSON.stringify({ v: 1, kind: 'mcd', name: 'Shop', updatedAt: '2026-11-01T00:00:00.000Z', mcd: {
        entities: [
          { id: 'a', name: 'CLIENT', x: 100, y: 100, attributes: [attr('a1', 'id_client', true)] },
          { id: 'b', name: 'COMMANDE', x: 300, y: 140, attributes: [attr('b1', 'id_commande', true)] },
          { id: 'c', name: 'PRODUIT', x: 700, y: 100, attributes: [attr('c1', 'id_produit', true)] }
        ],
        associations: [{ id: 's', name: 'PASSER', x: 220, y: 320, attributes: [] }],
        links: [{ id: 'l1', entity: 'a', association: 's', card: '0,n' }, { id: 'l2', entity: 'b', association: 's', card: '1,1' }],
        notes: [] } }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Shop', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  const project = file.replace(/[\\/]conception[\\/]shop\.mcd\.json$/, '')
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=shop.mcd.json`)
  const saved = () => JSON.parse(readFileSync(file, 'utf-8')).mcd
  const at = (name: string) => { const e = saved().entities.find((x: { name: string }) => x.name === name); return e && [e.x, e.y] }
  const [client, commande, produit] = ['CLIENT', 'COMMANDE', 'PRODUIT'].map(n => page.locator(`[data-entity="${n}"]`))
  const panel = page.getByRole('complementary', { name: 'Élément choisi' })

  // Zoomed out as far as it goes (the CI's small window fits the model at 29 %): the parts' link points
  // must not cover them, a click still picks them
  for (let i = 0; i < 10 && (await page.getByText('20 %').count()) === 0; i++) await page.getByRole('button', { name: 'Dézoomer', exact: true }).click()
  await expect(page.getByText('20 %')).toBeVisible()

  // The three entities picked: lined up on the highest one, then spread out (each 150 wide: 100, 400, 700)
  await client.click()
  await commande.click({ modifiers: ['Shift'] })
  await produit.click({ modifiers: ['Shift'] })
  await expect(panel.getByRole('status')).toHaveText('3 éléments sélectionnés')
  // The selection panel (align, spread, duplicate): nothing axe objects to
  expect(await settledAxe(page)).toEqual([])
  await panel.getByRole('button', { name: 'Aligner en haut' }).click()
  await expect.poll(() => at('COMMANDE')).toEqual([300, 100])
  await panel.getByRole('button', { name: 'Répartir horizontalement' }).click()
  await expect.poll(() => [at('CLIENT'), at('COMMANDE'), at('PRODUIT')]).toEqual([[100, 100], [400, 100], [700, 100]])
  // Two picked: nothing to spread
  await commande.click()
  await client.click({ modifiers: ['Shift'] })
  await expect(panel.getByRole('button', { name: 'Répartir horizontalement' })).toBeDisabled()

  // CLIENT and PASSER copied, then pasted: their leg comes with them, not the one to COMMANDE
  await commande.click()
  await client.click()
  await page.locator('[data-association="PASSER"]').click({ modifiers: ['Shift'] })
  await page.keyboard.press('Control+c')
  await page.keyboard.press('Control+v')
  await expect(page.locator('[data-entity="CLIENT_2"]')).toHaveAttribute('data-picked', 'true')
  await expect(page.locator('[data-association="PASSER_2"]')).toHaveAttribute('data-picked', 'true')
  await expect(panel.getByRole('status')).toHaveText('2 éléments sélectionnés')
  await expect.poll(() => saved().links.length).toBe(3)
  expect(at('CLIENT_2')).toEqual([124, 124])

  // Duplicated from the panel: CLIENT_3 and PASSER_3; one step back takes them away
  await panel.getByRole('button', { name: 'Dupliquer' }).click()
  await expect(page.locator('[data-entity="CLIENT_3"]')).toBeVisible()
  await expect.poll(() => saved().links.length).toBe(4)
  await page.keyboard.press('Control+z')
  await expect(page.locator('[data-entity="CLIENT_3"]')).toHaveCount(0)
  await expect(page.locator('[data-entity="CLIENT_2"]')).toBeVisible()
})

test('MPD: a table duplicated keeps its key; tables pasted in another MPD', async () => {
  let dir = ''
  run = await launch({
    seed: d => {
      dir = d
      const project = join(d, 'blog')
      mkdirSync(join(project, 'conception'), { recursive: true })
      const mpd = (name: string, tables: object[]) => JSON.stringify({ v: 1, kind: 'mpd', name, updatedAt: '2026-11-01T00:00:00.000Z', mpd: { engine: 'postgres', tables } })
      writeFileSync(join(project, 'conception', 'blog.mpd.json'), mpd('Blog', [
        { id: 'tA', name: 'auteur', x: 80, y: 80, indexes: [], columns: [col('cA', 'id', { pk: true })] },
        { id: 'tB', name: 'article', x: 380, y: 80, indexes: [], columns: [col('cB', 'id', { pk: true }), col('cF', 'auteur_id', { ref: { table: 'tA', column: 'cA' } })] }
      ]))
      writeFileSync(join(project, 'conception', 'autre.mpd.json'), mpd('Autre', []))
      writeFileSync(join(d, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Blog', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  const project = join(dir, 'blog')
  const tables = (f: string) => JSON.parse(readFileSync(join(project, 'conception', f), 'utf-8')).mpd.tables as { id: string; name: string; columns: { name: string; ref?: { table: string } }[] }[]
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=blog.mpd.json&tab=mpd`)
  const canvas = page.getByTestId('mpd-canvas')

  // article picked, Ctrl+D: article_2, its key still to auteur
  await canvas.locator('[data-table="article"]').locator('div').first().click()
  await page.keyboard.press('Control+d')
  await expect(canvas.locator('[data-table="article_2"]')).toContainText('auteur_id')
  await expect.poll(() => tables('blog.mpd.json').find(t => t.name === 'article_2')?.columns[1].ref?.table).toBe('tA')

  // Both first tables copied, pasted in another MPD of the project: the key follows the copy of auteur
  await canvas.locator('[data-table="auteur"]').locator('div').first().click()
  await canvas.locator('[data-table="article"]').locator('div').first().click({ modifiers: ['Shift'] })
  await page.keyboard.press('Control+c')
  await goTo(page, `/model?project=${encodeURIComponent(project)}&file=autre.mpd.json&tab=mpd`)
  await expect(page.getByText(/Pas encore de table/)).toBeVisible()
  await page.keyboard.press('Control+v')
  await expect(page.getByTestId('mpd-canvas').locator('[data-table]')).toHaveCount(2)
  await expect.poll(() => {
    const list = tables('autre.mpd.json')
    const auteur = list.find(t => t.name === 'auteur'), article = list.find(t => t.name === 'article')
    return !!auteur && article?.columns[1].ref?.table === auteur.id
  }).toBe(true)
})
