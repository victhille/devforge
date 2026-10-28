import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.6 lot 4: a table exported to a file, a CSV imported (Windows' dialogs answered by the test) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a table of 2,500 rows exports in three formats; a CSV imports, or is refused whole with its line', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT)')
  const insert = db.prepare('INSERT INTO client (name, city) VALUES (?, ?)')
  for (let i = 1; i <= 2500; i++) insert.run([`Client ${i}`, i % 2 ? 'Nantes' : "L'Haÿ"])
  insert.free()
  let dir = ''
  let file = ''
  run = await launch({
    seed: d => {
      dir = d
      file = join(d, 'e2e.sqlite')
      writeFileSync(file, Buffer.from(db.export()))
      writeFileSync(join(d, 'databases.json'), JSON.stringify([{ id: 'e2e', name: 'E2E SQLite', type: 'sqlite', file, color: '#5B9BFF' }]))
    }
  })
  const { app, page } = run
  /** The next save dialog answers this path */
  const saveTo = (path: string) => app.evaluate(({ dialog }, p) => { dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as never }, path)
  const openFrom = (path: string) => app.evaluate(({ dialog }, p) => { dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [p] })) as never }, path)

  await goTo(page, '/database')
  await page.getByRole('button', { name: /E2E SQLite/ }).click()
  await page.getByRole('table').getByRole('button', { name: 'client' }).click()

  // Export: every row, not just the page shown
  const exportAs = async (label: string, path: string) => {
    await saveTo(path)
    await page.getByRole('button', { name: 'Exporter' }).click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    await expect(page.getByText('2500 ligne(s) exportée(s)').last()).toBeVisible()
  }
  await exportAs('CSV', join(dir, 'out.csv'))
  const csv = readFileSync(join(dir, 'out.csv'), 'utf-8').split('\n')
  expect(csv.length).toBe(2501)
  expect(csv[0]).toBe('id,name,city')
  expect(csv[2500]).toBe("2500,Client 2500,L'Haÿ")

  await exportAs('JSON', join(dir, 'out.json'))
  const json = JSON.parse(readFileSync(join(dir, 'out.json'), 'utf-8'))
  expect(json).toHaveLength(2500)
  expect(json[1001]).toEqual({ id: 1002, name: 'Client 1002', city: "L'Haÿ" })

  await exportAs('SQL (CREATE TABLE et INSERT)', join(dir, 'out.sql'))
  // Played back into an empty database, the table comes back whole
  const copy = new SQL.Database()
  copy.exec(readFileSync(join(dir, 'out.sql'), 'utf-8'))
  expect(copy.exec('SELECT COUNT(*), MAX(id) FROM client')[0].values).toEqual([[2500, 2500]])
  expect(copy.exec('SELECT city FROM client WHERE id = 2')[0].values).toEqual([["L'Haÿ"]])

  // Import: semicolons, French accents in Windows-1252, a column named differently
  const latin = Buffer.from('Name;City;Ignored\nÉlodie;Nîmes;x\nZoé;;y\n', 'latin1')
  writeFileSync(join(dir, 'in.csv'), latin)
  await openFrom(join(dir, 'in.csv'))
  await page.getByRole('button', { name: 'Importer un CSV' }).click()
  const dialog = page.getByRole('dialog', { name: 'Importer un CSV dans client' })
  await dialog.getByRole('button', { name: 'Choisir un fichier CSV' }).click()
  await expect(dialog.getByText('in.csv · 2 ligne(s) · séparateur ; · windows-1252')).toBeVisible()
  await expect(dialog.getByRole('combobox', { name: 'Colonne de la table pour Name' })).toHaveValue('name')
  await expect(dialog.getByRole('combobox', { name: 'Colonne de la table pour Ignored' })).toHaveValue('')
  expect(await settledAxe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Importer 2 ligne(s)' }).click()
  await expect(dialog).toHaveCount(0)
  const count = () => new SQL.Database(readFileSync(file)).exec("SELECT COUNT(*) FROM client")[0].values[0][0]
  const last = new SQL.Database(readFileSync(file)).exec('SELECT name, city FROM client WHERE id > 2500 ORDER BY id')[0].values
  expect(last).toEqual([['Élodie', 'Nîmes'], ['Zoé', null]])

  // A refused row (name is required): none kept, its line named
  writeFileSync(join(dir, 'bad.csv'), 'name,city\nOk,Paris\n,Lyon\n')
  await openFrom(join(dir, 'bad.csv'))
  await page.getByRole('button', { name: 'Importer un CSV' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Choisir un fichier CSV' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Importer 2 ligne(s)' }).click()
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('la ligne 3 du fichier est refusée')
  expect(count()).toBe(2502)
})
