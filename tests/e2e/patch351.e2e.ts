import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import initSqlJs from 'sql.js'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5.1: the fixes after trying 3.5.0 */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const file = (path: string, content: string | Buffer) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }

/** A one-page PDF, its cross-reference offsets worked out */
function tinyPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length 44 >>\nstream\nBT /F1 24 Tf 40 100 Td (Cahier) Tj ET\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

test('a group: one-line buttons when folded, the rest of its folder, files previewed', async () => {
  run = await launch({
    seed: dir => {
      const g = join(dir, 'code', 'time-manager')
      file(join(g, 'backend', 'package.json'), JSON.stringify({ dependencies: { express: '^5' } }))
      file(join(g, 'frontend', 'package.json'), JSON.stringify({ dependencies: { react: '^19' } }))
      file(join(g, 'README.md'), '# Time manager\n\nUn **gestionnaire** de temps.\n\n- back\n- front\n')
      file(join(g, 'docs', 'cahier.pdf'), tinyPdf())
      file(join(g, 'infra', 'Dockerfile'), 'FROM nginx:alpine\n')
      file(join(g, 'docs', 'logo.zip'), Buffer.from([0x50, 0x4b, 3, 4, 0, 0]))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'tm', name: 'time-manager', path: g, framework: 'group', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false },
        { id: 'p2', name: 'lifehub', path: join(dir, 'code', 'lifehub'), framework: 'react', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false }
      ]))
      writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', onboarded: true, launcherEnabled: false, defaultProjectsDir: join(dir, 'code'), defaultIDE: 'vscode' }))
    }
  })
  const { page } = run
  await goTo(page, '/projects')
  const card = page.locator('.df-rise', { has: page.getByRole('heading', { name: 'time-manager' }) }).last()

  // Unfolded: the rest of the folder under its projects
  const extras = card.getByTestId('group-extras')
  await expect(extras).toContainText('Aussi dans le dossier :')
  await expect(extras).toContainText('docs/')
  await expect(extras).toContainText('infra/')
  await expect(extras).toContainText('README.md')

  // Folded: short labels, each button on one line
  await card.getByRole('button', { name: 'Replier le groupe' }).click()
  await expect(card.getByText('backend · frontend + 3 autres')).toBeVisible()
  for (const button of await card.locator('button.flex-1').all()) {
    const { scrollHeight, clientHeight } = await button.evaluate(b => ({ scrollHeight: b.scrollHeight, clientHeight: b.clientHeight }))
    expect(scrollHeight).toBeLessThanOrEqual(clientHeight)
  }
  await expect(card.getByRole('button', { name: 'Ouvrir', exact: true })).toBeVisible()

  // The filters row leads to the projects folders
  await page.getByRole('button', { name: 'Ajouter un dossier' }).click()
  await expect(page).toHaveURL(/section=general/)
  await expect(page.getByRole('button', { name: 'Ajouter un dossier' })).toBeVisible()

  // Files: README formatted, its source, a PDF drawn, a binary refused
  await goTo(page, '/project/tm?tab=files')
  await page.getByRole('button', { name: 'README.md' }).click()
  const preview = page.getByTestId('file-preview')
  await expect(preview.getByRole('heading', { name: 'Time manager' })).toBeVisible()
  await expect(preview.locator('strong')).toHaveText('gestionnaire')
  await page.getByRole('button', { name: 'Voir le source' }).click()
  await expect(preview.locator('pre')).toContainText('# Time manager')
  expect(await settledAxe(page)).toEqual([])

  await page.getByRole('button', { name: 'docs' }).click()
  await page.getByRole('button', { name: 'cahier.pdf' }).click()
  await expect(preview.locator('canvas')).toHaveCount(1, { timeout: 15_000 })
  await page.getByRole('button', { name: 'logo.zip' }).click()
  await expect(preview).toHaveText('Fichier binaire : pas d\'aperçu.')
  await page.getByRole('button', { name: 'infra' }).click()
  await page.getByRole('button', { name: 'Dockerfile' }).click()
  await expect(preview.locator('pre')).toHaveText('FROM nginx:alpine\n')
  await page.getByRole('button', { name: "Fermer l'aperçu" }).click()
  await expect(preview).toHaveCount(0)
})

test('closing the last tab of the docked terminal closes it', async () => {
  test.skip(process.platform !== 'win32', 'PowerShell')
  run = await launch()
  const { page } = run
  const dock = page.getByRole('region', { name: 'Terminal' })
  await page.getByRole('button', { name: 'Terminal' }).first().click()
  await expect(dock.getByRole('textbox', { name: 'Commande' })).toBeEnabled({ timeout: 20_000 })

  // "Hide" keeps the shell
  await dock.getByRole('button', { name: 'Masquer' }).click()
  await expect(dock).toBeHidden()
  await page.getByRole('button', { name: 'Terminal' }).first().click()
  await expect(dock).toBeVisible()

  await dock.getByRole('button', { name: /^Fermer / }).click()
  await expect(dock).toHaveCount(0)
  // Opened again: a fresh shell
  await page.getByRole('button', { name: 'Terminal' }).first().click()
  await expect(dock.getByRole('textbox', { name: 'Commande' })).toBeEnabled({ timeout: 20_000 })
})

test('tables are created, changed and dropped, the SQL shown first; rows copy as JSON', async () => {
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run("CREATE TABLE client (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO client (name) VALUES ('Ada'), ('Linus');")
  let dbFile = ''
  run = await launch({
    seed: dir => {
      dbFile = join(dir, 'e2e.sqlite')
      writeFileSync(dbFile, Buffer.from(db.export()))
      writeFileSync(join(dir, 'databases.json'), JSON.stringify([{ id: 'e2e', name: 'E2E SQLite', type: 'sqlite', file: dbFile, color: '#5B9BFF' }]))
    }
  })
  const { page } = run
  await goTo(page, '/database')
  await page.getByRole('button', { name: /E2E SQLite/ }).click()

  // Rows: CSV by default, JSON on request (kept)
  await page.getByRole('table').getByRole('button', { name: 'client' }).click()
  await expect(page.getByText('Linus')).toBeVisible()
  await page.getByRole('button', { name: 'json' }).click()
  // What is handed to the clipboard (the system one is shared with the PC)
  await page.evaluate(() => {
    const w = window as unknown as { copied: string[] }
    w.copied = []
    navigator.clipboard.writeText = async (text: string) => { w.copied.push(text) }
  })
  await page.getByRole('button', { name: 'Copier en JSON' }).click()
  const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied)
  expect(copied.map(c => JSON.parse(c))).toEqual([[{ id: 1, name: 'Ada' }, { id: 2, name: 'Linus' }]])

  // A new table: an id ready, one column typed, the SQL before it runs
  await page.getByRole('button', { name: 'Nouvelle table' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle table' })
  await dialog.getByLabel('Nom de la table').fill('invoice')
  await dialog.getByRole('textbox', { name: 'Nom', exact: true }).nth(1).fill('total')
  await dialog.getByRole('combobox', { name: 'Type' }).nth(1).fill('REAL')
  await expect(dialog.getByTestId('ddl-preview')).toHaveText('CREATE TABLE "invoice" (\n  "id" INTEGER PRIMARY KEY AUTOINCREMENT,\n  "total" REAL\n);')
  expect(await settledAxe(page)).toEqual([])
  await dialog.getByRole('button', { name: 'Créer la table' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'invoice' })).toBeVisible()

  // Structure: add a column, rename it, drop it
  await page.getByRole('button', { name: 'Ajouter une colonne' }).click()
  const add = page.getByRole('dialog', { name: 'Ajouter une colonne' })
  await add.getByRole('textbox', { name: 'Nom', exact: true }).fill('status')
  await add.getByRole('combobox', { name: 'Type' }).fill('TEXT')
  await add.getByRole('textbox', { name: 'Défaut' }).fill('draft')
  await expect(add.getByTestId('ddl-preview')).toHaveText('ALTER TABLE "invoice" ADD COLUMN "status" TEXT DEFAULT \'draft\';')
  await add.getByRole('button', { name: 'Appliquer' }).click()
  await expect(page.getByRole('cell', { name: 'status', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Modifier la colonne status' }).click()
  const edit = page.getByRole('dialog', { name: 'Modifier la colonne status' })
  await edit.getByRole('combobox', { name: 'Type' }).fill('INTEGER')
  await expect(edit.getByText(/SQLite ne sait que renommer une colonne/)).toBeVisible()
  await expect(edit.getByRole('button', { name: 'Appliquer' })).toBeDisabled()
  await edit.getByRole('combobox', { name: 'Type' }).fill('TEXT')
  await edit.getByRole('textbox', { name: 'Nom', exact: true }).fill('state')
  await edit.getByRole('button', { name: 'Appliquer' }).click()
  await expect(page.getByRole('cell', { name: 'state', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Supprimer la colonne state' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer la colonne' }).click()
  await expect(page.getByRole('cell', { name: 'state', exact: true })).toHaveCount(0)

  // Rename, then drop with its name typed again
  await page.getByRole('button', { name: 'Renommer la table' }).click()
  const rename = page.getByRole('dialog', { name: 'Renommer la table' })
  await rename.getByLabel('Nom de la table').fill('invoices')
  await rename.getByRole('button', { name: 'Appliquer' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'invoices' })).toBeVisible()

  await page.getByRole('button', { name: 'Supprimer la table' }).click()
  const drop = page.getByRole('dialog', { name: 'Supprimer la table' })
  await expect(drop.getByRole('button', { name: 'Supprimer la table' })).toBeDisabled()
  await drop.getByLabel('Tape « invoices » pour confirmer').fill('invoices')
  await drop.getByRole('button', { name: 'Supprimer la table' }).click()
  await expect(page.getByRole('table').getByRole('button', { name: 'invoices' })).toHaveCount(0)

  // Written to the file
  const after = new SQL.Database(readFileSync(dbFile))
  expect(after.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")[0].values.flat()).toEqual(['client'])
})
