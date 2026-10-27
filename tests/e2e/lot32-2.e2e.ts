import { expect, test } from '@playwright/test'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.2 lot 2: the help is one click (or F1) away. Nothing is clicked: that would open the real browser */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('help button, first launch and pages to set up lead to the site', async () => {
  run = await launch({ settings: { onboarded: false } })
  const { page } = run
  const welcome = page.getByRole('dialog', { name: 'Bienvenue dans DevForge' })
  await expect(welcome).toBeVisible()
  await expect(welcome.getByRole('button', { name: 'Lire la prise en main sur le site' })).toBeVisible()
  await welcome.getByRole('button', { name: 'Passer', exact: true }).click()

  await expect(page.getByRole('button', { name: 'Aide sur cette page' })).toHaveAttribute('title', 'Aide sur cette page (F1)')
  await goTo(page, '/status')
  await expect(page.getByText('Aucun serveur configuré')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Comment faire' })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})
