import { expect, test } from '@playwright/test'
import { resolve } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { acceptConfirms } from './confirm'

/** Settings › Connections › MCP servers for Forgy: the catalog, and a server added by hand (run on this PC) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const FAKE = resolve(__dirname, '../fixtures/fake-mcp-server.mjs')

test('the catalog shows the official servers, and a server added by hand gives Forgy its tools', async () => {
  run = await launch({ settings: { onboarded: true } })
  const { page } = run
  await acceptConfirms(page)
  await goTo(page, '/settings?section=connections')

  const card = page.getByRole('region', { name: 'Serveurs MCP pour Forgy' })
  await expect(card.getByText('Vercel', { exact: true })).toBeVisible()
  await expect(card.getByText('Context7', { exact: true })).toBeVisible()
  // Only those without an account
  await card.getByRole('radio', { name: 'Sans compte' }).click()
  await expect(card.getByText('Vercel', { exact: true })).toHaveCount(0)
  await expect(card.getByText('Playwright', { exact: true })).toBeVisible()
  await card.getByRole('radio', { name: 'Tous' }).click()
  expect(await settledAxeIssues(page)).toEqual([])

  // A server run on this PC: the command is said before it is added
  await card.getByRole('button', { name: 'Ajouter un serveur MCP' }).click()
  const dialog = page.getByRole('dialog', { name: 'Ajouter un serveur MCP' })
  await dialog.getByRole('textbox', { name: 'Nom' }).fill('Fake')
  await dialog.getByRole('textbox', { name: 'Adresse ou commande' }).fill(`node "${FAKE}"`)
  await dialog.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(card.getByText('3 outils · 2 en lecture seule')).toBeVisible({ timeout: 30_000 })

  // Off for Forgy, then removed
  const toggle = card.getByRole('switch', { name: 'Forgy peut utiliser Fake' })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(card.getByText('Coupé pour Forgy')).toBeVisible()
  await card.getByRole('button', { name: 'Retirer Fake' }).click()
  await expect(card.getByText('Fake', { exact: true })).toHaveCount(0)
  expect(await settledAxeIssues(page)).toEqual([])
})
