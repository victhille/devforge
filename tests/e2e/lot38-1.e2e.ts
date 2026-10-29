import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.8 lot 1: a project's tasks and notes (piste A), and their count on its card */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('tasks are added, checked, edited, deleted; notes are formatted text; the card counts what is left', async () => {
  run = await launch({
    seed: dir => {
      const shop = join(dir, 'shop')
      mkdirSync(shop, { recursive: true })
      writeFileSync(join(shop, 'package.json'), '{}')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/p?tab=notes')

  const tasks = page.getByTestId('tasks')
  const add = tasks.getByRole('textbox', { name: 'Ajouter une tâche… (Entrée)' })
  for (const t of ['Brancher Stripe', 'Corriger l\'arrondi du total', 'Page mot de passe oublié']) { await add.fill(t); await add.press('Enter') }
  await expect(tasks.getByRole('checkbox')).toHaveCount(3)
  await expect(tasks).toContainText('3 à faire')
  await expect(page.getByRole('tab', { name: /Notes/ })).toContainText('3')

  // Checked, then hidden; edited; deleted
  await tasks.getByRole('checkbox', { name: 'Brancher Stripe' }).click()
  await expect(tasks.getByRole('checkbox', { name: 'Brancher Stripe' })).toHaveAttribute('aria-checked', 'true')
  await expect(tasks).toContainText(/fait le/)
  await tasks.getByRole('button', { name: 'Masquer les faites' }).click()
  await expect(tasks.getByRole('checkbox')).toHaveCount(2)
  await tasks.getByText('Page mot de passe oublié').dblclick()
  await tasks.getByRole('textbox', { name: 'Modifier la tâche' }).fill('Page « mot de passe oublié »')
  await page.keyboard.press('Enter')
  await expect(tasks).toContainText('Page « mot de passe oublié »')
  await tasks.getByText('Corriger l\'arrondi du total').hover()
  await tasks.getByRole('listitem').filter({ hasText: 'Corriger' }).getByRole('button', { name: 'Supprimer la tâche' }).click()
  await expect(tasks.getByRole('checkbox')).toHaveCount(1)

  // v3.8.1: formatted text, written as in a word processor
  const notes = page.getByTestId('notes')
  const editor = notes.getByRole('textbox', { name: 'Notes' })
  await editor.click()
  await notes.getByRole('combobox', { name: 'Style du paragraphe' }).selectOption('h1')
  await page.keyboard.type('Mise en ligne')
  await page.keyboard.press('Enter')
  await notes.getByRole('combobox', { name: 'Style du paragraphe' }).selectOption('p')
  await page.keyboard.type('vider le ')
  await page.keyboard.press('Control+b')
  await page.keyboard.type('cache')
  await page.keyboard.press('Control+b')
  await page.keyboard.type(' puis ')
  await notes.getByRole('button', { name: 'Souligné (Ctrl+U)' }).click()
  await page.keyboard.type('relancer')
  await expect(notes.getByRole('button', { name: 'Souligné (Ctrl+U)' })).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.getByRole('heading', { name: 'Mise en ligne', level: 1 })).toBeVisible()
  await expect(editor.locator('b')).toHaveText('cache')
  await expect(editor.locator('u')).toHaveText('relancer')
  expect(await settledAxe(page)).toEqual([])

  // Kept: after a reload, and counted on the card (1 open task)
  await page.waitForTimeout(800)
  await page.reload()
  await expect(page.getByTestId('notes').getByRole('heading', { name: 'Mise en ligne' })).toBeVisible()
  await expect(page.getByTestId('notes').locator('u')).toHaveText('relancer')
  await goTo(page, '/projects')
  const chip = page.getByTestId('tasks-chip')
  await expect(chip).toHaveText('1 à faire')
  await chip.click()
  await expect(page).toHaveURL(/\/project\/p\?tab=notes/)
})

test('notes written in Markdown before v3.8.1 open formatted', async () => {
  run = await launch({
    seed: dir => {
      const shop = join(dir, 'shop')
      mkdirSync(shop, { recursive: true })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
      writeFileSync(join(dir, 'project-notes.json'), JSON.stringify({ p: { tasks: [], notes: '# Mise en ligne\n\n- vider le **cache**\n- <script>x</script>', updatedAt: '' } }))
    }
  })
  const { page } = run
  await goTo(page, '/project/p?tab=notes')
  const editor = page.getByTestId('notes').getByRole('textbox', { name: 'Notes' })
  await expect(editor.getByRole('heading', { name: 'Mise en ligne' })).toBeVisible()
  await expect(editor.locator('li b')).toHaveText('cache')
  // Text that looked like a tag stays text
  await expect(editor.locator('li').nth(1)).toHaveText('<script>x</script>')
})
