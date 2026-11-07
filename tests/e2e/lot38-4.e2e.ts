import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.8 lot 4: the database schema, full screen (piste B) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('the schema shows tables and links, hides and adds tables, moves a card, exports, opens a structure', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  for (const sql of [
    'CREATE TABLE user (id INTEGER PRIMARY KEY, email TEXT NOT NULL)',
    'CREATE TABLE address (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES user(id), city TEXT)',
    'CREATE TABLE category (id INTEGER PRIMARY KEY, label TEXT)',
    'CREATE TABLE product (id INTEGER PRIMARY KEY, category_id INTEGER REFERENCES category(id), price REAL NOT NULL)',
    'CREATE TABLE "order" (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES user(id), total REAL)',
    'CREATE TABLE order_item (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES "order"(id), product_id INTEGER REFERENCES product(id))',
    'CREATE TABLE coupon (code TEXT PRIMARY KEY, rate REAL)'
  ]) db.run(sql)
  let dir = ''
  run = await launch({
    seed: d => {
      dir = d
      const file = join(d, 'shop.sqlite')
      writeFileSync(file, Buffer.from(db.export()))
      writeFileSync(join(d, 'databases.json'), JSON.stringify([{ id: 'shop', name: 'Shop', type: 'sqlite', file, color: '#5B9BFF' }]))
    }
  })
  const { app, page } = run
  await goTo(page, '/database')
  await page.getByRole('button', { name: /Shop/ }).click()
  await page.getByRole('button', { name: 'Schéma' }).click()

  const dialog = page.getByRole('dialog', { name: 'Schéma — shop.sqlite' })
  const canvas = dialog.getByTestId('schema-canvas')
  const card = (name: string) => canvas.locator(`[data-table=".${name}"]`)
  await expect(canvas.locator('[data-table]')).toHaveCount(7)
  // v3.8.1: over the whole window, never inside the page (whose animation would hold a fixed element)
  await expect(page.locator('body > [role=dialog]')).toHaveCount(1)
  await expect(card('order_item')).toContainText('product_id')
  // 5 links, each with its arrow head
  await expect(canvas.locator('svg g')).toHaveCount(5)
  await expect(dialog.getByTestId('schema-minimap')).toBeVisible()
  await expect(dialog).toContainText('7 tables sur 7')

  // Parents on the left of their children
  const x = async (name: string) => (await card(name).boundingBox())!.x
  expect(await x('user')).toBeLessThan(await x('order'))
  expect(await x('order')).toBeLessThan(await x('order_item'))

  // Shown tables: none, then one and its neighbours
  const tables = dialog.getByRole('complementary', { name: 'Tables du schéma' })
  await tables.getByRole('button', { name: 'Aucune' }).click()
  await expect(canvas).toContainText('Coche à gauche les tables à montrer.')
  await tables.getByRole('checkbox', { name: 'order', exact: true }).check()
  await tables.getByRole('button', { name: '+ voisines' }).click()
  await expect(canvas.locator('[data-table]')).toHaveCount(3)
  await expect(dialog).toContainText('3 tables sur 7')
  await tables.getByRole('textbox', { name: 'Rechercher une table…' }).fill('cou')
  await expect(tables.getByRole('checkbox')).toHaveCount(1)
  await tables.getByRole('button', { name: 'Toutes' }).click()
  await tables.getByRole('textbox', { name: 'Rechercher une table…' }).fill('')
  await expect(canvas.locator('[data-table]')).toHaveCount(4)
  expect(await settledAxe(page)).toEqual([])

  // A card moved by its header stays where it was put, after closing too
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('devforge:db-schema:shop') ?? '{}').pos?.['.coupon'] as { x: number; y: number })
  const start = await stored()
  const before = (await card('coupon').boundingBox())!
  const grab = { x: before.x + 30, y: before.y + 15 }
  await page.mouse.move(grab.x, grab.y)
  await page.mouse.down()
  await page.mouse.move(grab.x + 60, grab.y + 20, { steps: 5 })
  await page.mouse.move(grab.x + 160, grab.y + 40, { steps: 5 })
  await page.mouse.up()
  expect((await card('coupon').boundingBox())!.x - before.x).toBeGreaterThan(80)
  await expect(dialog).toBeVisible()
  const moved = await stored()
  expect(moved.x - start.x).toBeGreaterThan(80)
  await dialog.getByRole('button', { name: 'Fermer' }).click()
  await page.getByRole('button', { name: 'Schéma' }).click()
  await expect(canvas.locator('[data-table]')).toHaveCount(4)
  expect(await stored()).toEqual(moved)

  // Exports
  await app.evaluate(({ dialog: d }, p) => { d.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never }, join(dir, 'schema.svg'))
  await dialog.getByRole('button', { name: 'SVG' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Schéma enregistré' })).toBeVisible()
  const svg = readFileSync(join(dir, 'schema.svg'), 'utf-8')
  expect(svg).toContain('>order_item</text>')
  expect(svg).not.toContain('>category</text>')
  await app.evaluate(({ dialog: d }, p) => { d.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never }, join(dir, 'schema.png'))
  await dialog.getByRole('button', { name: 'PNG' }).click()
  await expect.poll(() => { try { return readFileSync(join(dir, 'schema.png')).subarray(1, 4).toString() } catch { return '' } }).toBe('PNG')

  // A click on a card opens its structure
  await card('order').getByRole('button', { name: 'Ouvrir la structure de order' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.locator('main h1')).toHaveText('order')
  await expect(page.getByRole('tab', { name: 'Structure' })).toHaveAttribute('aria-selected', 'true')
})
