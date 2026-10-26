import { expect, test } from '@playwright/test'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.0: the pages that need a server wait for one in the menu and the palette, and show up as soon as one is added */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('server pages are listed only once a server is set up', async () => {
  run = await launch()
  const { page } = run
  page.on('dialog', d => d.accept())
  const menu = page.getByRole('complementary')
  const palette = page.getByPlaceholder('Rechercher pages, projets, scripts, serveurs…')

  // No server: Deploy stays, n8n / VPN / status page wait, and the menu says so
  await goTo(page, '/settings?section=connections')
  await menu.getByRole('button', { name: 'Mise en ligne' }).click()
  await expect(menu.getByRole('link', { name: 'Déploiement' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'n8n' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'VPN' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: '3 de plus avec un serveur' })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  await page.keyboard.press('Control+k')
  await palette.fill('wireguard')
  await expect(page.getByRole('button', { name: 'VPN' })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // The page itself stays reachable, and leads to Connections
  await goTo(page, '/vpn')
  await expect(page.getByText('Aucun serveur configuré')).toBeVisible()

  // A server added: the pages show up at once
  await goTo(page, '/settings?section=connections')
  await page.getByRole('button', { name: 'Ajouter un serveur' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nom', { exact: true }).fill('Banc')
  await dialog.getByLabel('Hôte / IP').fill('127.0.0.1')
  await dialog.getByLabel("Nom d'utilisateur").fill('test')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(menu.getByRole('link', { name: 'n8n' })).toBeVisible()
  await expect(menu.getByRole('link', { name: 'VPN' })).toBeVisible()
  await expect(menu.getByText('de plus avec un serveur')).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await palette.fill('wireguard')
  await expect(page.getByRole('button', { name: 'VPN' })).toBeVisible()
  await page.keyboard.press('Escape')

  // Removed: they wait again
  await page.getByRole('button', { name: 'Retirer Banc' }).click()
  await expect(menu.getByRole('link', { name: 'n8n' })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: '3 de plus avec un serveur' })).toBeVisible()
})
