import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5 lot 3: an IDE added by hand, chosen for one project */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('an IDE added by hand joins the choices, and one project keeps it as its own', async () => {
  run = await launch({
    seed: dir => {
      const shop = join(dir, 'code', 'shop')
      mkdirSync(shop, { recursive: true })
      writeFileSync(join(shop, 'package.json'), '{}')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'shop', path: shop, framework: 'nodejs', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false }]))
      writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', onboarded: true, launcherEnabled: false, defaultProjectsDir: join(dir, 'code'), defaultIDE: 'none' }))
    }
  })
  const { page, userData } = run
  const settings = () => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf-8'))

  await goTo(page, '/settings?section=general')
  await page.getByRole('button', { name: 'Ajouter un IDE' }).click()
  await page.getByLabel('Nom', { exact: true }).fill('Antigravity')
  // Any existing program stands in for the IDE (never started: no "Try" here)
  await page.getByLabel('Programme (.exe, .cmd, .bat)').fill(process.execPath)
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: "Enregistrer l'IDE" }).click()
  await expect.poll(() => settings().customIdes?.map((c: { name: string }) => c.name)).toEqual(['Antigravity'])
  // The one added by hand can be picked; the catalog's, not found on this PC, cannot
  await expect(page.getByLabel('IDE par défaut').locator('option:not([disabled])', { hasText: 'Antigravity' })).toHaveCount(1)

  // The project's page: its own IDE
  await goTo(page, '/project/p1')
  await page.getByLabel('IDE de ce projet').selectOption({ label: 'Antigravity' })
  const id = settings().customIdes[0].id
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'projects.json'), 'utf-8'))[0].ide).toBe(id)
  await expect(page.getByRole('button', { name: "Ouvrir dans l'IDE · Antigravity" })).toBeVisible()

  // Its card names it, though the default is none
  await goTo(page, '/projects')
  await expect(page.getByRole('button', { name: 'Antigravity', exact: true })).toBeVisible()
})
