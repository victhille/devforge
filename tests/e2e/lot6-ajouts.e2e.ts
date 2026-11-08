import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { confirmButton, confirmDialog } from './confirm'

/** Lot 6 of the Forge redesign: the mock-up's additions on the Data, System and Tools pages */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('tools: diff without whitespace, JSON keys in order, a Laravel APP_KEY', async () => {
  run = await launch({ settings: { onboarded: true, motion: 'reduced' } })
  const { page } = run

  await goTo(page, '/diff')
  await page.getByPlaceholder('Colle le texte original…').fill('services:\n  web:\n    image: node:20 ')
  await page.getByPlaceholder('Colle le texte modifié…').fill('services:\n    web:\n    image: node:20')
  await expect(page.getByText('+2 ajouté')).toBeVisible()
  // The checkbox's input is hidden behind its box: its label takes the click
  await page.getByText('Ignorer les espaces').click()
  await expect(page.getByRole('checkbox', { name: 'Ignorer les espaces' })).toBeChecked()
  await expect(page.getByText('+0 ajouté')).toBeVisible()
  await page.getByRole('button', { name: 'Inverser' }).click()
  await expect(page.getByPlaceholder('Colle le texte original…')).toHaveValue('services:\n    web:\n    image: node:20')
  expect(await settledAxeIssues(page)).toEqual([])

  await goTo(page, '/toolbox')
  await page.getByPlaceholder('{"key": "value"}').fill('{"statut":"ok","client":{"ville":"Nantes","nom":"Ada"}}')
  await page.getByRole('button', { name: 'Trier les clés' }).click()
  await expect(page.getByRole('textbox', { name: 'Sortie' })).toHaveValue('{\n  "client": {\n    "nom": "Ada",\n    "ville": "Nantes"\n  },\n  "statut": "ok"\n}')

  await goTo(page, '/generator')
  const secret = page.locator('div').filter({ has: page.getByRole('heading', { name: 'Secret / Token' }) }).filter({ has: page.getByRole('button', { name: 'Générer', exact: true }) }).last()
  await secret.getByRole('tab', { name: 'Base64' }).click()
  await secret.getByText('Préfixe base64: (APP_KEY de Laravel)').click()
  await expect(secret.getByRole('checkbox', { name: 'Sûr pour une URL' })).toHaveCount(0)
  await secret.getByRole('button', { name: 'Générer', exact: true }).click()
  await expect(secret.getByText(/^base64:[A-Za-z0-9+/]{43}=$/)).toBeVisible()
  await expect(secret.getByText('256 bits d’aléa')).toBeVisible()
})

test('.env: a secret is drawn again after a yes, never an API key', async () => {
  let app = ''
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      app = join(dir, 'shop')
      mkdirSync(app)
      writeFileSync(join(app, '.env'), 'APP_KEY=base64:old\nSTRIPE_KEY=sk_test_1\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Shop', path: app, framework: 'laravel', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/env-files')
  await page.getByRole('button', { name: /Shop/ }).click()
  await expect(page.getByText('Système / Variables .env')).toBeVisible()
  const row = (key: string) => page.getByRole('row').filter({ has: page.getByRole('cell', { name: key, exact: true }) })
  await expect(row('STRIPE_KEY').getByRole('button', { name: 'Régénérer' })).toHaveCount(0)
  await row('APP_KEY').hover()
  await row('APP_KEY').getByRole('button', { name: 'Régénérer' }).click()
  await expect(confirmDialog(page)).toContainText('Remplacer APP_KEY dans .env')
  await confirmButton(page).click()
  await expect(page.getByText('APP_KEY régénéré dans .env')).toBeVisible()
  const env = readFileSync(join(app, '.env'), 'utf-8')
  expect(env).toMatch(/^APP_KEY=base64:[A-Za-z0-9+/]{43}=$/m)
  expect(env).toContain('STRIPE_KEY=sk_test_1')
})

test('domains in a table with their state; logs and webhooks say where they stand', async () => {
  let log = ''
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      // A log is opened only inside a project's folder
      const api = join(dir, 'api')
      mkdirSync(join(api, 'storage', 'logs'), { recursive: true })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Api', path: api, framework: 'laravel', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
      log = join(api, 'storage', 'logs', 'laravel.log')
      writeFileSync(log, '[2026-11-08 10:00:00] local.ERROR: SQLSTATE[23000]\n[2026-11-08 10:00:01] local.WARNING: slow mail\n[2026-11-08 10:00:02] local.INFO: invoice sent\n')
      writeFileSync(join(dir, 'domains.json'), JSON.stringify([{ id: 'd1', domain: 'shop.test', port: 3999, enabled: false }]))
    }
  })
  const { page } = run

  await goTo(page, '/domains')
  await expect(page.getByText('Actifs : 0 sur 1')).toBeVisible()
  const domain = page.getByRole('row').filter({ hasText: 'shop.test' })
  await expect(domain).toContainText('localhost:3999')
  await expect(domain).toContainText('désactivé')
  expect(await settledAxeIssues(page)).toEqual([])

  await goTo(page, '/logs')
  await expect(page.locator('main h1')).toHaveText('Logs')
  // The page reads ?file= when it opens: leave it first
  await goTo(page, '/webhooks')
  await expect(page.getByText('Arrêté', { exact: true })).toBeVisible()
  await goTo(page, `/logs?file=${encodeURIComponent(log)}`)
  await expect(page.getByRole('button', { name: 'Erreurs 1' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Avertissements 1' }).click()
  await expect(page.getByRole('button', { name: 'Avertissements 1' })).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByText('slow mail')).toHaveCount(0)
})
