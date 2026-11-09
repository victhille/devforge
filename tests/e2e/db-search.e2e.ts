import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** The Search tab: the whole database at once, the term lit, the SQL and the table one click away */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a term found in every table, the case, the words, a column and the tables chosen; the SQL and the table from a result', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run("CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT, email TEXT, city TEXT); INSERT INTO client (name, email, city) VALUES ('Élodie Martin', 'elodie@example.com', 'Paris'), ('Ada Lovelace', 'ada@example.org', 'Londres'), ('Linus', NULL, 'Paris 11e')")
  db.run("CREATE TABLE invoice (id INTEGER PRIMARY KEY, client_id INTEGER, note TEXT); INSERT INTO invoice (client_id, note) VALUES (1, 'Envoyée à elodie@example.com'), (2, 'Payée')")
  db.run("CREATE TABLE log (at TEXT, line TEXT); INSERT INTO log VALUES ('t1', 'rien')")
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
  await page.getByRole('tab', { name: 'Rechercher' }).click()

  // The field ready, nothing searched yet
  const field = page.getByRole('searchbox', { name: 'Un e-mail, un nom, un numéro…' })
  await expect(field).toBeFocused()
  await expect(page.getByText('Cherche dans toute la base')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  // Every table, the case ignored (accents kept): the term lit where it is, its column first after the key
  await field.fill('ELODIE')
  await field.press('Enter')
  const results = page.getByRole('region', { name: 'Résultats de la recherche' })
  await expect(results.getByRole('status')).toHaveText(/^2 ligne\(s\) dans 2 table\(s\) · 3 table\(s\) fouillée\(s\) en /)
  const client = results.getByRole('article', { name: 'client' })
  await expect(client.getByText('1 ligne(s)')).toBeVisible()
  await expect(client.locator('mark')).toHaveText(['elodie'])
  await expect(client.getByRole('columnheader')).toHaveText(['id', 'email', 'name', 'city'])
  await expect(results.getByRole('article', { name: 'invoice' }).locator('mark')).toHaveText(['elodie'])
  await expect(results.getByText(/Rien dans :/)).toContainText('log')
  expect(await settledAxe(page)).toEqual([])

  // An accented capital found in lower case
  await field.fill('ÉLODIE')
  await field.press('Enter')
  await expect(results.getByRole('status')).toHaveText(/^1 ligne\(s\) dans 1 table\(s\)/)
  await expect(results.getByRole('article', { name: 'client' }).locator('mark')).toHaveText(['Élodie'])
  await field.fill('ELODIE')

  // The case kept: nothing
  const search = page.getByRole('button', { name: 'Rechercher', exact: true })
  await page.getByText('Respecter la casse', { exact: true }).click()
  await search.click()
  await expect(results.getByRole('status')).toHaveText('Rien trouvé pour « ELODIE ».')
  await page.getByText('Respecter la casse', { exact: true }).click()

  // Every word somewhere in the row
  await page.getByRole('combobox', { name: 'Mode de recherche' }).selectOption('all')
  await field.fill('paris 11e')
  await search.click()
  await expect(results.getByRole('status')).toHaveText(/^1 ligne\(s\) dans 1 table\(s\)/)
  await expect(results.getByRole('article', { name: 'client' }).getByRole('cell', { name: 'Linus' })).toBeVisible()

  // One column: only the tables that have it are searched
  await page.getByRole('combobox', { name: 'Mode de recherche' }).selectOption('contains')
  await page.getByRole('combobox', { name: 'Dans la colonne' }).fill('note')
  await field.fill('payée')
  await search.click()
  await expect(results.getByRole('status')).toHaveText(/^1 ligne\(s\) dans 1 table\(s\) · 1 table\(s\) fouillée\(s\)/)
  await page.getByRole('combobox', { name: 'Dans la colonne' }).fill('')

  // Some tables only
  await page.getByRole('button', { name: /^Tables : toutes \(3\)/ }).click()
  await page.getByRole('group', { name: 'Tables' }).getByText('invoice', { exact: true }).click()
  await expect(page.getByRole('button', { name: /^Tables : 2 sur 3/ })).toHaveAttribute('aria-expanded', 'true')
  await field.fill('elodie')
  await search.click()
  await expect(results.getByRole('status')).toHaveText(/^1 ligne\(s\) dans 1 table\(s\) · 2 table\(s\) fouillée\(s\)/)

  // A regular expression that does not compile is said before anything runs
  await page.getByRole('combobox', { name: 'Mode de recherche' }).selectOption('regex')
  await field.fill('([a-z')
  await search.click()
  await expect(page.getByRole('alert')).toContainText('Expression régulière invalide')
  await page.getByRole('combobox', { name: 'Mode de recherche' }).selectOption('contains')
  await field.fill('elodie')
  await search.click()
  await expect(results.getByRole('status')).toHaveText(/^1 ligne\(s\)/)

  // Its SQL, every row, in the SQL tab; the results are still there after
  await results.getByRole('article', { name: 'client' }).getByRole('button', { name: 'Voir le SQL' }).click()
  await expect(page.getByRole('tab', { name: 'SQL' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('textbox', { name: 'Requête SQL' })).toHaveValue(/^SELECT \* FROM "client"\nWHERE .*df_lower\('elodie'\)/)
  await page.getByRole('button', { name: /^Exécuter/ }).click()
  await expect(page.getByRole('cell', { name: 'Élodie Martin' })).toBeVisible()
  await page.getByRole('tab', { name: 'Rechercher' }).click()
  await expect(results.getByRole('article', { name: 'client' })).toBeVisible()

  // The table itself, from its result
  await results.getByRole('article', { name: 'client' }).getByRole('button', { name: 'Ouvrir la table' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'client' })).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Données' })).toHaveAttribute('aria-selected', 'true')
})
