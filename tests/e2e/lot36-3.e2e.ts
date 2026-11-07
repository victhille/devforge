import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.6 lot 3: rows edited in the Browse tab, applied in one transaction */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('cells edited, a row added and one deleted go out together; an error keeps none; no key, no editing', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run("CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT NOT NULL, note TEXT); INSERT INTO client (name, note) VALUES ('Ada', 'math'), ('Linus', 'kernel'), ('Grace', 'cobol')")
  db.run("CREATE TABLE log (at TEXT, line TEXT); INSERT INTO log VALUES ('t1', 'hello')")
  let file = ''
  run = await launch({
    seed: dir => {
      file = join(dir, 'e2e.sqlite')
      writeFileSync(file, Buffer.from(db.export()))
      writeFileSync(join(dir, 'databases.json'), JSON.stringify([{ id: 'e2e', name: 'E2E SQLite', type: 'sqlite', file, color: '#5B9BFF' }]))
    }
  })
  const { page } = run
  const rows = () => new SQL.Database(readFileSync(file)).exec('SELECT id, name, note FROM client ORDER BY id')[0].values

  await goTo(page, '/database')
  await page.getByRole('button', { name: /E2E SQLite/ }).click()
  await page.getByRole('table').getByRole('button', { name: 'client' }).click()
  await expect(page.getByText('Linus')).toBeVisible()

  // A cell edited, then set to NULL
  await page.getByRole('cell', { name: 'Linus' }).dblclick()
  await page.getByRole('textbox', { name: 'Valeur de name' }).fill('Linus T.')
  await page.keyboard.press('Enter')
  await page.getByRole('cell', { name: 'cobol' }).dblclick()
  await page.getByRole('button', { name: 'NULL' }).click()

  // A new row (the id left to its default) and a row deleted
  await page.getByRole('button', { name: 'Ajouter une ligne' }).click()
  const added = page.getByTestId('new-row')
  // Its cells: remove, +, id, name, note
  await added.getByRole('cell').nth(3).dblclick()
  await page.getByRole('textbox', { name: 'Valeur de name' }).fill('Margaret')
  await page.keyboard.press('Enter')
  await page.getByRole('checkbox', { name: 'Cocher la ligne 1' }).check()
  await page.getByRole('button', { name: 'Supprimer (1)' }).click()
  expect(await settledAxe(page)).toEqual([])

  // Nothing is written before Apply, and the SQL is shown first
  expect(rows()).toEqual([[1, 'Ada', 'math'], [2, 'Linus', 'kernel'], [3, 'Grace', 'cobol']])
  await page.getByRole('button', { name: 'Appliquer (4 modifications)' }).click()
  const dialog = page.getByRole('dialog', { name: 'Appliquer 4 modification(s)' })
  await expect(dialog.getByTestId('rows-preview')).toHaveText([
    `UPDATE "client" SET "name" = 'Linus T.' WHERE "id" = 2;`,
    `UPDATE "client" SET "note" = NULL WHERE "id" = 3;`,
    `INSERT INTO "client" ("name") VALUES ('Margaret');`,
    `DELETE FROM "client" WHERE "id" = 1;`
  ].join('\n'))
  await dialog.getByRole('button', { name: 'Appliquer' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Margaret')).toBeVisible()
  expect(rows()).toEqual([[2, 'Linus T.', 'kernel'], [3, 'Grace', null], [4, 'Margaret', null]])

  // An error (name is required): nothing kept, the message stays
  await page.getByRole('cell', { name: 'Grace' }).dblclick()
  await page.getByRole('textbox', { name: 'Valeur de name' }).fill('Grace H.')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Ajouter une ligne' }).click()
  await page.getByRole('button', { name: 'Appliquer (2 modifications)' }).click()
  const failing = page.getByRole('dialog')
  await failing.getByRole('button', { name: 'Appliquer' }).click()
  await expect(failing.getByRole('alert')).toContainText(/Rien n'a été modifié.*NOT NULL/)
  expect(rows()).toEqual([[2, 'Linus T.', 'kernel'], [3, 'Grace', null], [4, 'Margaret', null]])
  await failing.getByRole('button', { name: 'Annuler' }).click()
  await page.getByRole('button', { name: 'Annuler les modifications' }).click()
  await expect(page.getByRole('cell', { name: 'Grace', exact: true })).toBeVisible()

  // A table without a primary key stays read only
  // The second button opens the table (the first unfolds its columns)
  await page.getByRole('complementary', { name: 'tables' }).getByRole('button', { name: 'log', exact: true }).last().click()
  await expect(page.getByText(/Sans clé primaire/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ajouter une ligne' })).toHaveCount(0)
})
