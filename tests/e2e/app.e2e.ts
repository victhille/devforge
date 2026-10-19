import { expect, test } from '@playwright/test'
import { createServer, type Server } from 'http'
import type { AddressInfo } from 'net'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'

let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('starts on the home page and records the data format', async () => {
  run = await launch()
  await expect(run.page.locator('main h1')).toHaveText(/^(Bonjour|Bonsoir)/)
  expect(JSON.parse(readFileSync(join(run.userData, 'storage.json'), 'utf-8'))).toEqual({ schemaVersion: 1 })
})

test('keeps the data of a 1.x install', async () => {
  run = await launch({
    seed: dir => writeFileSync(join(dir, 'projects.json'), JSON.stringify([
      { id: 'p1', name: 'Legacy project', path: dir, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
    ]))
  })
  await goTo(run.page, '/projects')
  await expect(run.page.getByRole('heading', { name: 'Legacy project' })).toBeVisible()
  expect(JSON.parse(readFileSync(join(run.userData, 'storage.json'), 'utf-8'))).toEqual({ schemaVersion: 1 })
})

test('sidebar groups unfold and lead to their pages', async () => {
  run = await launch()
  const { page } = run
  await page.getByRole('button', { name: 'Développement' }).click()
  await page.getByRole('link', { name: 'Git', exact: true }).click()
  await expect(page).toHaveURL(/#\/git$/)
  await expect(page.locator('main h1')).toHaveText('Tableau de bord Git')
  // Favorites stay one click away
  await page.getByRole('link', { name: 'Docker' }).click()
  await expect(page.locator('main h1')).toHaveText('Docker')
})

test('API Tester shows an HTML answer as a preview', async () => {
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end('<!doctype html><html><body><h1>Hello E2E</h1></body></html>')
  })
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r))
  try {
    run = await launch()
    const { page } = run
    await goTo(page, '/api-tester')
    await page.getByLabel('URL').fill(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`)
    await page.getByRole('button', { name: 'Envoyer' }).click()
    await expect(page.getByText('200 OK')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Aperçu' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.frameLocator('iframe[title="Aperçu"]').locator('h1')).toHaveText('Hello E2E')
    await page.getByRole('tab', { name: 'Brut' }).click()
    await expect(page.locator('pre')).toContainText('<h1>Hello E2E</h1>')
  } finally {
    server.close()
  }
})

test('Database browses a SQLite file', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run("CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO client (name) VALUES ('Ada'), ('Linus');")
  run = await launch({
    seed: dir => {
      const file = join(dir, 'e2e.sqlite')
      writeFileSync(file, Buffer.from(db.export()))
      writeFileSync(join(dir, 'databases.json'), JSON.stringify([{ id: 'e2e', name: 'E2E SQLite', type: 'sqlite', file, color: '#5B9BFF' }]))
    }
  })
  const { page } = run
  await goTo(page, '/database')
  await page.getByRole('button', { name: /E2E SQLite/ }).click()
  await page.getByRole('table').getByRole('button', { name: 'client' }).click()
  await expect(page.getByText('Linus')).toBeVisible()
})

test('Forgy asks for an API key when none is saved', async () => {
  run = await launch()
  const { page } = run
  await page.keyboard.press('Control+J')
  await expect(page.getByText(/Ajoute ta clé API Anthropic/)).toBeVisible()
  await expect(page.getByPlaceholder('Demande à Forgy…')).toBeVisible()
})

test('Settings copies a diagnostic report without secrets', async () => {
  run = await launch()
  const { app, page } = run
  await goTo(page, '/settings')
  await page.getByRole('button', { name: 'Copier le rapport' }).click()
  await expect(page.getByText('Rapport copié')).toBeVisible()
  const report = await app.evaluate(({ clipboard }) => clipboard.readText())
  expect(report).toMatch(/^DevForge v\d+\.\d+\.\d+/)
  expect(report).toContain('Data format v1')
})
