import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'

/** Project hub: one page per project, with what belongs to it */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

async function start() {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run("CREATE TABLE orders (id INTEGER PRIMARY KEY, total REAL); INSERT INTO orders (total) VALUES (42.5);")
  run = await launch({
    seed: dir => {
      const project = join(dir, 'shop')
      mkdirSync(join(project, 'storage', 'logs'), { recursive: true })
      writeFileSync(join(project, '.env'), 'PORT=4321\nAPP_KEY=secret\n')
      writeFileSync(join(project, 'storage', 'logs', 'app.log'), '[2026-10-19] local.ERROR: boom\n')
      writeFileSync(join(project, 'shop.sqlite'), Buffer.from(db.export()))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'Shop', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(dir, 'databases.json'), JSON.stringify([{ id: 'lite', name: 'Shop SQLite', type: 'sqlite', file: join(project, 'shop.sqlite'), color: '#5B9BFF' }]))
    }
  })
}

test('a project page gathers its resources and becomes the active project', async () => {
  await start()
  const { page } = run
  await goTo(page, '/project/p1')
  await expect(page.locator('main h1')).toHaveText('Shop')
  await expect(page.getByText('Projet actif', { exact: true })).toBeVisible()

  // Overview: env file (key count, never the values), port from .env
  await expect(page.getByText('.env · 2 clé(s)')).toBeVisible()
  await expect(page.locator('main')).not.toContainText('secret')

  // Database tab: the SQLite file inside the project is linked, and opens in Database
  await page.getByRole('tab', { name: /Base de données/ }).click()
  await expect(page.getByText('Shop SQLite')).toBeVisible()
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click()
  await expect(page).toHaveURL(/#\/database\?conn=lite/)
  await expect(page.getByRole('table').getByRole('button', { name: 'orders' })).toBeVisible()

  // The home page shows the active project
  await goTo(page, '/')
  await expect(page.getByRole('button', { name: 'Shop' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvrir le projet' })).toBeVisible()
})

test('a found resource can be hidden and shown again', async () => {
  await start()
  const { page } = run
  await goTo(page, '/project/p1?tab=logs')
  await expect(page.getByText('app.log')).toBeVisible()
  await page.getByText('app.log').hover()
  await page.getByRole('button', { name: 'Retirer du projet' }).click()
  await expect(page.getByText('Masqués')).toBeVisible()
  await page.getByRole('button', { name: 'Réafficher' }).click()
  await expect(page.getByText('Masqués')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Suivre' })).toBeVisible()
})
