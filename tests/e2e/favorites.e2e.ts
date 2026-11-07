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

  // Pin Deploy from the "Going live" group
  await menu.getByRole('button', { name: 'Mise en ligne' }).click()
  const deployRow = menu.locator('.group\\/row', { has: page.getByRole('link', { name: 'Déploiement', exact: true }) }).last()
  await deployRow.hover()
  await deployRow.getByRole('button', { name: 'Ajouter aux favoris' }).click()
  await expect(favs(run)).toHaveText(['Projets', 'Docker', 'Base de données', 'API Tester', 'Déploiement'])
  await expect.poll(() => saved(run)).toEqual(['/projects', '/docker', '/database', '/api-tester', '/deploy'])

  // Unpin Docker: it stays reachable in its group (Going live, open)
  const dockerFav = page.locator('[data-fav]', { has: page.getByRole('link', { name: 'Docker' }) })
  await dockerFav.hover()
  await dockerFav.getByRole('button', { name: 'Retirer des favoris' }).click()
  await expect(favs(run)).toHaveText(['Projets', 'Base de données', 'API Tester', 'Déploiement'])
  await expect(menu.getByRole('link', { name: 'Docker', exact: true })).toBeVisible()

  // Keyboard reorder: Deploy goes up one
  await favs(run).nth(3).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(favs(run)).toHaveText(['Projets', 'Base de données', 'Déploiement', 'API Tester'])
  await expect(favs(run).nth(2)).toBeFocused()

  // Kept after a restart of the window's page
  await page.reload()
  await expect(favs(run)).toHaveText(['Projets', 'Base de données', 'Déploiement', 'API Tester'])

  // Back to the defaults
  await menu.getByText('Favoris').hover()
  await menu.getByRole('button', { name: 'Remettre les favoris par défaut' }).click()
  await expect(favs(run)).toHaveText(['Projets', 'Docker', 'Base de données', 'API Tester'])
  await expect.poll(() => saved(run)).toEqual(['/projects', '/docker', '/database', '/api-tester'])
})

test('a favorite that needs a server waits for one, and is kept when the others move', async () => {
  run = await launch({ seed: dir => writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', onboarded: true, motion: 'reduced', favorites: ['/projects', '/vpn', '/docker'] })) })
  const { page } = run
  await goTo(page, '/')
  await expect(favs(run)).toHaveText(['Projets', 'Docker'])
  await favs(run).nth(1).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(favs(run)).toHaveText(['Docker', 'Projets'])
  await expect.poll(() => saved(run)).toEqual(['/docker', '/projects', '/vpn'])
})
