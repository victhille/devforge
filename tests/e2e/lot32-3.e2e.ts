import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.2 lot 3: n8n and the status page's ntfy alerts in Settings › Connections (the server's answers simulated) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SEP = '\n@@DF@@\n'
const config = { title: 'Statut', intervalSec: 60, failuresBeforeDown: 3, monitors: [], alerts: { ntfy: null, webhook: null } }

test('n8n key and ntfy alerts are set from Connections', async () => {
  run = await launch({
    env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' },
    seed: dir => {
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'mon-serveur', host: '203.0.113.10', port: 1, username: 'deploy', authMethod: 'privateKey', color: '', createdAt: '' }]))
      writeFileSync(join(dir, 'n8n.json'), JSON.stringify({ instances: [{ connectionId: 'v1', domain: 'n8n.example.com', exposure: 'caddy', installedAt: '2026-10-27T10:00:00Z' }] }))
      writeFileSync(join(dir, 'status.json'), JSON.stringify({ pages: [{ connectionId: 'v1', exposure: 'caddy', domain: 'status.example.com', installedAt: '2026-10-27T10:00:00Z' }] }))
      writeFileSync(join(dir, 'vps.json'), JSON.stringify({ statusOverview: ['yes', 'status|running', JSON.stringify(config), '', '', '', ''].join(SEP) }))
    }
  })
  const { page } = run
  page.on('dialog', d => d.accept())
  await goTo(page, '/settings?section=connections')

  // n8n: no key yet, its form, the way to its page
  await expect(page.getByText('n8n · mon-serveur')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('n8n.example.com')).toBeVisible()
  await expect(page.getByLabel('Clé API n8n')).toBeVisible()

  // Alerts: read on the server when asked; a topic ntfy would not take is refused, said plainly
  await expect(page.getByText('Page de statut · mon-serveur')).toBeVisible()
  await page.getByRole('button', { name: 'Lire les alertes' }).click()
  await expect(page.getByText("pas d'alerte ntfy")).toBeVisible()
  await page.getByLabel(/Sujet ntfy/).fill('un sujet avec des espaces')
  await page.getByRole('button', { name: 'Enregistrer' }).last().click()
  await expect(page.getByRole('alert')).toContainText('sujet ou serveur refusé')
  expect(await settledAxe(page)).toEqual([])
})
