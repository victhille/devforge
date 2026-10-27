import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v3.2 lot 7: no language mix (New project, project dates) and Forgy with ANTHROPIC_API_KEY */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const project = (dir: string) => {
  const path = join(dir, 'shop')
  mkdirSync(path)
  writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'shop', path, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-15T10:00:00.000Z', lastOpenedAt: null }]))
}

test('New project speaks French: templates, options, libraries', async () => {
  run = await launch()
  const { page } = run
  await goTo(page, '/new-project')
  await expect(page.getByText('Interfaces avec React et Vite')).toBeVisible()
  await expect(page.getByText('Build UIs with React + Vite')).toHaveCount(0)
  await page.getByRole('button', { name: /React/ }).first().click()
  await expect(page.getByRole('checkbox', { name: 'Installer les dépendances' })).toBeVisible()
  await page.getByLabel('Nom du projet').fill('vitrine')
  await page.getByRole('button', { name: 'Suivant →' }).click()
  await expect(page.getByText('Framework CSS à base de classes utilitaires')).toBeVisible()
})

test('project dates follow the interface language', async () => {
  run = await launch({ settings: { language: 'en' }, seed: project })
  await goTo(run.page, '/project/p1')
  await expect(run.page.getByText('Jan 15, 2026')).toBeVisible()
  await run.close()

  run = await launch({ seed: project })
  await goTo(run.page, '/project/p1')
  await expect(run.page.getByText('15 janv. 2026')).toBeVisible()
})

test('Forgy uses ANTHROPIC_API_KEY without asking for a key', async () => {
  run = await launch({ env: { ANTHROPIC_API_KEY: 'sk-ant-e2e-not-a-key' } })
  const { page } = run
  await goTo(page, '/settings?section=forgy')
  await expect(page.getByText('Clé lue dans ANTHROPIC_API_KEY ; une clé enregistrée ici la remplace')).toBeVisible()
  await page.keyboard.press('Control+J')
  await expect(page.getByPlaceholder('Demande à Forgy…')).toBeVisible()
  await expect(page.getByText(/Ajoute ta clé API Anthropic/)).toHaveCount(0)
  await goTo(page, '/settings?section=connections')
  await expect(page.getByText('clé lue dans ANTHROPIC_API_KEY')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Retirer', exact: true })).toHaveCount(0)
})
