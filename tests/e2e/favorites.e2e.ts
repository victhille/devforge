import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** Menu favorites: pin from a group, unpin, reorder, reset; kept in settings.json */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const favs = (r: Launched) => r.page.locator('[data-fav] a')
const saved = (r: Launched) => (JSON.parse(readFileSync(join(r.userData, 'settings.json'), 'utf-8')) as { favorites: string[] }).favorites

test('pin, reorder and reset the menu favorites', async () => {
  run = await launch({ seed: dir => writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', onboarded: true, motion: 'reduced' })) })
  const { page } = run
  await goTo(page, '/')
  const menu = page.getByRole('complementary')
  await expect(favs(run)).toHaveText(['Projets', 'Docker', 'Base de données', 'API Tester'])

  // Pin VPN from the Servers group
  await menu.getByRole('button', { name: 'Serveurs' }).click()
  const vpnRow = menu.locator('.group\\/row', { has: page.getByRole('link', { name: 'VPN', exact: true }) }).last()
  await vpnRow.hover()
  await vpnRow.getByRole('button', { name: 'Ajouter aux favoris' }).click()
  await expect(favs(run)).toHaveText(['Projets', 'Docker', 'Base de données', 'API Tester', 'VPN'])
  await expect.poll(() => saved(run)).toEqual(['/projects', '/docker', '/database', '/api-tester', '/vpn'])

  // Unpin Docker: it stays reachable in its group
  const dockerFav = page.locator('[data-fav]', { has: page.getByRole('link', { name: 'Docker' }) })
  await dockerFav.hover()
  await dockerFav.getByRole('button', { name: 'Retirer des favoris' }).click()
  await expect(favs(run)).toHaveText(['Projets', 'Base de données', 'API Tester', 'VPN'])
  await expect(menu.getByRole('link', { name: 'Docker', exact: true })).toBeVisible()

  // Keyboard reorder: VPN goes up one
  await favs(run).nth(3).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(favs(run)).toHaveText(['Projets', 'Base de données', 'VPN', 'API Tester'])
  await expect(favs(run).nth(2)).toBeFocused()

  // Kept after a restart of the window's page
  await page.reload()
  await expect(favs(run)).toHaveText(['Projets', 'Base de données', 'VPN', 'API Tester'])

  // Back to the defaults
  await menu.getByText('Favoris').hover()
  await menu.getByRole('button', { name: 'Remettre les favoris par défaut' }).click()
  await expect(favs(run)).toHaveText(['Projets', 'Docker', 'Base de données', 'API Tester'])
  await expect.poll(() => saved(run)).toEqual(['/projects', '/docker', '/database', '/api-tester'])
})
