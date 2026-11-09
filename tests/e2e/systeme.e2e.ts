import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** The System group as in the mock-up: environment, ports, .env files, domains, disk cleaning */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('environment in cards, ports in a table, .env files a tab each with secrets masked, domains with their state, a cleaning by kind', async () => {
  let shop = ''
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      // In a folder of its own: the cleaning scans it, away from the app's own data
      shop = join(dir, 'code', 'shop')
      mkdirSync(join(shop, 'node_modules', 'left-pad'), { recursive: true })
      writeFileSync(join(shop, 'node_modules', 'left-pad', 'index.js'), 'module.exports = s => s\n'.repeat(50))
      writeFileSync(join(shop, '.env'), 'NODE_ENV=development\nDATABASE_URL=postgres://app:hunter2@localhost/shop\nSESSION_SECRET=abc123\n')
      writeFileSync(join(shop, '.env.example'), 'NODE_ENV=\nDATABASE_URL=\nSESSION_SECRET=\nSTRIPE_KEY=\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'Shop', path: shop, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null },
        { id: 'p2', name: 'Notes', path: join(dir, 'notes'), framework: 'unknown', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
      writeFileSync(join(dir, 'domains.json'), JSON.stringify([{ id: 'd1', domain: 'shop.test', port: 3999, enabled: false }]))
    }
  })
  const { page } = run

  // Environment: a card per family, its count, a row per tool
  await goTo(page, '/environment')
  const js = page.getByRole('region', { name: 'JavaScript' })
  await expect(js).toBeVisible({ timeout: 30_000 })
  await expect(js.getByRole('listitem').first()).toContainText('Node.js')
  await expect(page.getByRole('region', { name: 'PHP' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Outils' })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  // Ports: Dev or all of them, a search, the free button said with its port
  await goTo(page, '/ports')
  await page.getByRole('tab', { name: 'Tous' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Ports' })).toBeVisible()
  await expect(page.getByText(/port\(s\) en écoute sur ce PC\./)).toBeVisible({ timeout: 20_000 })
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('tab', { name: 'Dev' }).click()

  // .env: every project on the left, the one with files first and its missing key counted
  await goTo(page, '/env-files')
  const shopButton = page.getByRole('button', { name: /^Shop/ })
  await expect(shopButton).toContainText('1')
  await expect(page.getByRole('button', { name: /^Notes/ })).toContainText('aucun')
  await shopButton.click()
  await expect(page.getByRole('tab', { name: /\.env\s*3/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByText('est dans .env.example mais pas dans .env.')).toBeVisible()
  const row = (key: string) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: key, exact: true }) })
  // A setting in clear, an address with a password and a secret masked until the eye shows them
  await expect(row('NODE_ENV')).toContainText('development')
  await expect(row('DATABASE_URL')).not.toContainText('hunter2')
  await expect(row('SESSION_SECRET')).toContainText('valeur masquée')
  await row('DATABASE_URL').getByRole('button', { name: 'Afficher DATABASE_URL' }).click()
  await expect(row('DATABASE_URL')).toContainText('hunter2')
  await expect(row('NODE_ENV').getByText('oui')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  // The template's tab has no « in the template » column
  await page.getByRole('tab', { name: /\.env\.example/ }).click()
  await expect(page.getByRole('columnheader', { name: 'Dans .env.example' })).toHaveCount(0)
  await page.getByRole('tab', { name: /^\.env\s*3/ }).click()
  // The missing key added from the template
  await page.getByRole('button', { name: 'L’ajouter' }).click()
  await expect(page.getByText('est dans .env.example mais pas dans .env.')).toHaveCount(0)
  expect(readFileSync(join(shop, '.env'), 'utf-8')).toContain('STRIPE_KEY=')

  // Domains: three cards, the table, a new one added from the header
  await goTo(page, '/domains')
  await expect(page.getByText('0 domaine(s) actif(s) sur 1')).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'shop.test' })).toContainText('désactivé')
  await page.getByRole('button', { name: 'Nouveau domaine' }).click()
  await expect(page.getByRole('textbox', { name: 'Domaine' })).toBeFocused()
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: 'Annuler' }).click()

  // Cleaning: the shop's node_modules found, counted by kind, deleted after a yes
  await goTo(page, '/cleaner')
  await page.getByRole('textbox', { name: 'Dossier à analyser' }).fill(join(shop, '..'))
  await page.getByRole('button', { name: 'Analyser', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Récupérable' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('dans 1 dossier(s)')).toBeVisible()
  await expect(page.getByRole('img', { name: /^Dépendances / })).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('row').filter({ hasText: 'node_modules' }).click()
  await page.getByRole('button', { name: /^Supprimer la sélection \(/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Supprimer / }).click()
  await expect.poll(() => existsSync(join(shop, 'node_modules'))).toBe(false)
})
