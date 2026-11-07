import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { launch, type Launched } from './launch'

/**
 * Forgy's actions in the built app, with a scripted model
 * (DEVFORGE_E2E_ASSISTANT_SCRIPT): the card, the click, the journal, undo.
 */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

/** A saved project with a .env, and a model that proposes to add NEW_FLAG */
async function start(): Promise<{ project: string }> {
  let project = ''
  run = await launch({
    seed: dir => {
      project = join(dir, 'shop')
      mkdirSync(project)
      writeFileSync(join(project, '.env'), 'APP_ENV=dev\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'Shop', path: project, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(dir, 'script.json'), JSON.stringify([
        { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'act1', name: 'env_add', input: { project: 'Shop', key: 'NEW_FLAG', value: 'on' } }] },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Variable ajoutée.' }] }
      ]))
    },
    env: { DEVFORGE_E2E_ASSISTANT_SCRIPT: '{userData}/script.json' }
  })
  return { project }
}

async function askForgy() {
  const { page } = run
  await page.keyboard.press('Control+J')
  const input = page.getByPlaceholder('Demande à Forgy…')
  await input.fill('Ajoute NEW_FLAG dans le .env de Shop')
  await input.press('Enter')
}

test('an approved action runs, is journaled and can be undone', async () => {
  const { project } = await start()
  await askForgy()
  const card = run.page.getByRole('group', { name: 'Add NEW_FLAG · Shop' })
  await expect(card).toContainText('NEW_FLAG=•')
  // Nothing happened yet
  expect(readFileSync(join(project, '.env'), 'utf-8')).not.toContain('NEW_FLAG')

  await card.getByRole('button', { name: 'Valider' }).click()
  await expect(card).toContainText('fait')
  expect(readFileSync(join(project, '.env'), 'utf-8')).toContain('NEW_FLAG=on')
  await expect(run.page.getByText('Variable ajoutée.')).toBeVisible()

  await run.page.getByRole('button', { name: 'Journal des actions' }).click()
  const entry = run.page.getByRole('group', { name: 'Add NEW_FLAG · Shop' })
  await entry.getByRole('button', { name: 'Annuler cette action' }).click()
  await expect(entry).toContainText('annulée')
  expect(readFileSync(join(project, '.env'), 'utf-8')).not.toContain('NEW_FLAG')
})

test('a refused action changes nothing', async () => {
  const { project } = await start()
  await askForgy()
  const card = run.page.getByRole('group', { name: 'Add NEW_FLAG · Shop' })
  await card.getByRole('button', { name: 'Refuser' }).click()
  await expect(card).toContainText('refusée')
  expect(readFileSync(join(project, '.env'), 'utf-8')).toBe('APP_ENV=dev\n')
})
