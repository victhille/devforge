import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** A project whose folder is gone leaves the list on its own (Undo puts it back); Forgy's project picker */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const entry = (id: string, name: string, path: string, framework: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  path,
  framework,
  packageManager: 'npm',
  favorite: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastOpenedAt: null,
  ...extra
})

test('a gone folder is taken out with Undo, and Forgy picks its project in a searchable list', async () => {
  run = await launch({
    settings: { onboarded: true },
    env: { DEVFORGE_TEST_PRUNE: '1', DEVFORGE_E2E_ASSISTANT_SCRIPT: '{userData}/script.json' },
    seed: dir => {
      for (const n of ['shop', 'blog']) mkdirSync(join(dir, n))
      writeFileSync(join(dir, 'script.json'), JSON.stringify([{ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] }]))
      writeFileSync(
        join(dir, 'projects.json'),
        JSON.stringify([
          entry('p1', 'Shop', join(dir, 'shop'), 'nextjs', { favorite: true }),
          entry('p2', 'Blog', join(dir, 'blog'), 'vue', { lastOpenedAt: '2026-11-01T10:00:00.000Z' }),
          entry('p3', 'Ghost', join(dir, 'moved-away', 'ghost'), 'react')
        ])
      )
    }
  })
  const { page } = run

  // A few seconds after the start: taken out, said, and Undo puts it back
  await expect(page.getByRole('status').getByText('« Ghost » retiré : son dossier est introuvable')).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('status').getByText('1 projet(s) remis dans DevForge')).toBeVisible()

  // Forgy's project: a list with a search, the favorites first, gone folders left out
  await goTo(page, '/projects')
  await page.keyboard.press('Control+J')
  const picker = page.getByRole('button', { name: 'Projet de la conversation : Aucun projet en contexte' })
  await picker.click()
  const list = page.getByRole('listbox', { name: 'Projet de la conversation' })
  await expect(list.getByRole('option')).toHaveText([/Aucun projet en contexte/, /Shop/, /Blog/])
  expect(await settledAxeIssues(page)).toEqual([])

  const search = page.getByRole('combobox', { name: 'Chercher un projet' })
  await search.fill('blo')
  await expect(list.getByRole('option')).toHaveText([/Blog/])
  await search.press('Enter')
  await expect(page.getByRole('button', { name: 'Projet de la conversation : Blog' })).toBeFocused()

  // Escape closes without changing it
  await page.getByRole('button', { name: 'Projet de la conversation : Blog' }).click()
  await page.getByRole('combobox', { name: 'Chercher un projet' }).press('ArrowDown')
  await page.getByRole('combobox', { name: 'Chercher un projet' }).press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Projet de la conversation : Blog' })).toBeVisible()
})
