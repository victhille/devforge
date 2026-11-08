import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** A project's notes: files of the project (.devforge/notes), their checkboxes its tasks, counted on its card */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const seedShop = (dir: string) => {
  const shop = join(dir, 'shop')
  mkdirSync(shop, { recursive: true })
  writeFileSync(join(shop, 'package.json'), '{}')
  writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
  return shop
}

test('notes are made, named, written with checkboxes, pinned and deleted; kept in the project; the card counts the boxes left', async () => {
  let shop = ''
  run = await launch({ seed: dir => { shop = seedShop(dir) } })
  const { page, app } = run
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900))
  await goTo(page, '/project/p?tab=notes')

  // Nothing yet: one button
  await expect(page.getByText('Aucune note')).toBeVisible()
  await page.getByRole('button', { name: 'Nouvelle note' }).click()
  const title = page.getByRole('textbox', { name: 'Titre de la note' })
  await expect(title).toBeFocused()
  await expect(title).toHaveValue('Sans titre')
  await page.keyboard.type('À faire avant la mise en ligne')
  await page.keyboard.press('Enter')

  // A checklist, typed
  const card = page.getByTestId('note')
  const editor = card.getByRole('textbox', { name: 'Texte de la note' })
  await expect(editor).toBeFocused()
  const toolbar = card.getByRole('toolbar', { name: 'Mise en forme' })
  await expect(toolbar.getByRole('button')).toHaveText(['B', 'I', 'H', '', '{}'])
  await toolbar.getByRole('button', { name: 'Liste à cocher' }).click()
  await expect(toolbar.getByRole('button', { name: 'Liste à cocher' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.type('Garder le panier')
  await page.keyboard.press('Enter')
  await page.keyboard.type("Corriger l'arrondi de la TVA")
  await page.keyboard.press('Enter')
  await page.keyboard.type('Domaine et certificat')
  const lines = editor.locator('ul[data-checklist] > li')
  await expect(lines).toHaveText(['Garder le panier', "Corriger l'arrondi de la TVA", 'Domaine et certificat'])
  await expect(page.getByRole('tab', { name: /Notes/ })).toContainText('3')

  // Checked with a click on its box (the line only), with Ctrl+Enter where the caret is
  await lines.first().click({ position: { x: 7, y: 11 } })
  await expect(lines.first()).toHaveAttribute('data-checked', 'true')
  await expect(lines.nth(1)).toHaveAttribute('data-checked', 'false')
  await page.keyboard.press('Control+Enter')
  await expect(lines.nth(2)).toHaveAttribute('data-checked', 'true')
  await expect(page.getByRole('tab', { name: /Notes/ })).toContainText('1')
  await page.keyboard.press('Control+Enter')
  await expect(lines.nth(2)).toHaveAttribute('data-checked', 'false')
  // A line made after a checked one starts unchecked
  await lines.first().click({ position: { x: 60, y: 11 } })
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Vider le cache')
  await expect(lines.nth(1)).toHaveText('Vider le cache')
  await expect(lines.nth(1)).toHaveAttribute('data-checked', 'false')
  await expect(page.getByRole('tab', { name: /Notes/ })).toContainText('3')

  // Out of the list (Enter on an empty line): a heading, bold, inline code
  await lines.last().click({ position: { x: 120, y: 11 } })
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Enter')
  await toolbar.getByRole('button', { name: 'Titre' }).click()
  await expect(toolbar.getByRole('button', { name: 'Titre' })).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.type('Serveur')
  // The line after a heading is text again
  await page.keyboard.press('Enter')
  await expect(toolbar.getByRole('button', { name: 'Titre' })).toHaveAttribute('aria-pressed', 'false')
  await page.keyboard.type('Déployé par ')
  await page.keyboard.press('Control+b')
  await page.keyboard.type('pm2')
  await page.keyboard.press('Control+b')
  await page.keyboard.type(' sur vps-demo')
  await expect(editor.getByRole('heading', { level: 3 })).toHaveText(['Serveur'])
  await expect(editor.locator('b')).toHaveText('pm2')
  await page.keyboard.press('End')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await toolbar.getByRole('button', { name: 'Code' }).click()
  await expect(editor.locator('code')).toHaveText('demo')
  await expect(card).toContainText(/Enregistré · /)

  // Pinned; a second note
  await card.getByRole('button', { name: 'Épingler la note' }).click()
  await expect(card.getByRole('button', { name: 'Épingler la note' })).toHaveAttribute('aria-pressed', 'true')
  const list = page.getByRole('list', { name: 'Notes du projet' })
  await expect(list.getByRole('button', { name: /\(épinglée\)/ })).toHaveCount(1)
  await page.getByRole('button', { name: 'Nouvelle note' }).click()
  await expect(title).toHaveValue('Sans titre')
  await expect(title).toBeFocused()
  await page.keyboard.type('Comptes de test Stripe')
  await page.keyboard.press('Enter')
  await page.keyboard.type('4242 4242 4242 4242')
  await expect(list.getByRole('button')).toHaveText(['À faire avant la mise en ligne (épinglée)', 'Comptes de test Stripe'])
  await expect(list.getByRole('button', { name: 'Comptes de test Stripe' })).toHaveAttribute('aria-current', 'true')
  expect(await settledAxe(page)).toEqual([])

  // In the project's folder, one file per note, readable
  const file = join(shop, '.devforge', 'notes', 'a-faire-avant-la-mise-en-ligne.md')
  await expect.poll(() => existsSync(join(shop, '.devforge', 'notes', 'comptes-de-test-stripe.md')) && readFileSync(file, 'utf-8'), { timeout: 5000 })
    .toContain('<li data-checked="true">Garder le panier</li>')
  const text = readFileSync(file, 'utf-8')
  expect(text).toMatch(/^---\ntitle: À faire avant la mise en ligne\npinned: true\n---\n<ul data-checklist>\n/)
  expect(text).toContain('<h3>Serveur</h3>')
  expect(text).toContain('<code>demo</code>')
  expect(existsSync(join(shop, '.devforge', 'notes', 'sans-titre.md'))).toBe(false)

  // Kept after a reload: the pinned note opens first
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'Titre de la note' })).toHaveValue('À faire avant la mise en ligne')
  await expect(page.getByTestId('note').locator('ul[data-checklist] > li[data-checked="true"]')).toHaveText(['Garder le panier'])
  await expect(page.getByRole('tab', { name: /Notes/ })).toContainText('3')

  // Deleted, after a question
  await page.getByRole('list', { name: 'Notes du projet' }).getByRole('button', { name: 'Comptes de test Stripe' }).click()
  await expect(page.getByRole('textbox', { name: 'Titre de la note' })).toHaveValue('Comptes de test Stripe')
  await page.getByTestId('note').getByRole('button', { name: 'Supprimer la note' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByRole('list', { name: 'Notes du projet' }).getByRole('button')).toHaveCount(1)
  await expect.poll(() => existsSync(join(shop, '.devforge', 'notes', 'comptes-de-test-stripe.md'))).toBe(false)
  await expect(page.getByRole('textbox', { name: 'Titre de la note' })).toHaveValue('À faire avant la mise en ligne')

  // Counted on the card
  await goTo(page, '/projects')
  const chip = page.getByTestId('tasks-chip')
  await expect(chip).toHaveText('3 à faire')
  await chip.click()
  await expect(page).toHaveURL(/\/project\/p\?tab=notes/)
})

test('the notes of v3.8 move into the project: tasks become a pinned checklist, Markdown opens formatted', async () => {
  let shop = ''
  let data = ''
  run = await launch({
    seed: dir => {
      data = dir
      shop = seedShop(dir)
      writeFileSync(join(dir, 'project-notes.json'), JSON.stringify({
        p: {
          tasks: [{ id: 'a', text: 'Brancher Stripe', done: false, createdAt: '' }, { id: 'b', text: 'Mettre à jour Symfony', done: true, createdAt: '', doneAt: '2026-10-26T08:00:00Z' }],
          notes: '# Mise en ligne\n\n- vider le **cache**\n- <script>x</script>', updatedAt: ''
        }
      }))
    }
  })
  const { page } = run
  await goTo(page, '/project/p?tab=notes')
  const list = page.getByRole('list', { name: 'Notes du projet' })
  await expect(list.getByRole('button')).toHaveText(['Tâches (épinglée)', 'Notes'])
  const card = page.getByTestId('note')
  await expect(card.locator('ul[data-checklist] > li')).toHaveText(['Brancher Stripe', 'Mettre à jour Symfony'])
  await expect(card.locator('ul[data-checklist] > li').nth(1)).toHaveAttribute('data-checked', 'true')
  await expect(page.getByRole('tab', { name: /Notes/ })).toContainText('1')
  expect(existsSync(join(data, 'project-notes.json'))).toBe(false)
  expect(readFileSync(join(shop, '.devforge', 'notes', 'taches.md'), 'utf-8')).toContain('pinned: true')

  await list.getByRole('button', { name: 'Notes' }).click()
  const editor = card.getByRole('textbox', { name: 'Texte de la note' })
  await expect(editor.getByRole('heading', { name: 'Mise en ligne' })).toBeVisible()
  await expect(editor.locator('li b')).toHaveText('cache')
  // Text that looked like a tag stays text
  await expect(editor.locator('li').nth(1)).toHaveText('<script>x</script>')
})
