import { expect, test } from '@playwright/test'
import { readFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** Settings redone: sections, search, saved on change; release notes and "What's new" */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('settings are found by search and saved on change', async () => {
  run = await launch()
  const { page, userData } = run
  await goTo(page, '/settings')
  const nav = page.getByRole('navigation', { name: 'Paramètres' })

  // Search narrows the sections
  await page.getByPlaceholder('Chercher un réglage…').fill('sauvegarde')
  await expect(nav.getByRole('button', { name: 'Données' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Apparence' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sauvegarder maintenant' }).click()
  await expect(page.getByText('Sauvegarde faite')).toBeVisible()
  await expect(page.getByText('manuelle')).toBeVisible()

  // A theme click is applied and written at once, no "Save" button
  await page.getByPlaceholder('Chercher un réglage…').fill('')
  await nav.getByRole('button', { name: 'Apparence' }).click()
  await page.getByRole('radio', { name: 'Clair' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf-8')).theme).toBe('light')
  await page.getByRole('radio', { name: 'Réduites' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced')

  // Alerts can be turned off one by one
  await nav.getByRole('button', { name: 'Serveurs' }).click()
  await page.getByRole('switch', { name: 'Un site tombe' }).click()
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'watch.json'), 'utf-8')).alerts.site).toBe(false)
})

test('release notes are cards filtered by kind, and "What\'s new" follows an update', async () => {
  run = await launch()
  const { page } = run
  await goTo(page, '/settings?notes=all')
  await expect(page.getByRole('heading', { name: '1.5.0' })).toBeVisible()
  await expect(page.getByText('DevForge change de tête', { exact: false }).first()).toBeVisible()
  await page.getByRole('radio', { name: /Corrections/ }).click()
  await expect(page.getByText('Rien de ce type dans cette version.').first()).toBeVisible()

  // Coming from an older version: the tour opens once
  const version = (JSON.parse(readFileSync('package.json', 'utf-8')) as { version: string }).version
  await page.evaluate(() => localStorage.setItem('devforge:last-version', '0.0.1'))
  await page.reload()
  await page.waitForSelector('main')
  const dialog = page.getByRole('dialog', { name: `Quoi de neuf dans DevForge ${version}` })
  await expect(dialog).toBeVisible()
  while (await dialog.getByRole('button', { name: 'Suivant' }).count()) await dialog.getByRole('button', { name: 'Suivant' }).click()
  await dialog.getByRole('button', { name: "C'est parti" }).click()
  await expect(dialog).toHaveCount(0)
})
