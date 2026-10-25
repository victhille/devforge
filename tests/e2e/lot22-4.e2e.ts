import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** v2.2 lot 4: the status page in DevForge (canned server outputs, no real VPS) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SEP = '\n@@DF@@\n'
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)

function seed(outputs: Record<string, string>) {
  return (dir: string) => {
    writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '203.0.113.10', port: 1, username: 'ubuntu', authMethod: 'privateKey', color: '', createdAt: '' }]))
    writeFileSync(join(dir, 'vps.json'), JSON.stringify(outputs))
    writeFileSync(join(dir, 'status.json'), JSON.stringify({ pages: [{ connectionId: 'v1', exposure: 'n8n', domain: 'status.203-0-113-10.sslip.io', installedAt: '2026-10-25T10:00:00Z' }] }))
  }
}

test('not installed: what holds 80/443 picks the way online, the address needs no DNS', async () => {
  run = await launch({
    env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' },
    seed: seed({ statusPrecheck: ['yes', 'yes', '0.0.0.0:22\n0.0.0.0:80\n0.0.0.0:443', 'yes', '', 'Status: active\n\nTo Action From\n22/tcp ALLOW IN Anywhere'].join(SEP), statusOverview: ['', '', '', '', '', '', ''].join(SEP) })
  })
  const { page } = run
  await goTo(page, '/status')
  await expect(page.getByRole('heading', { name: 'Installer la page de statut' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Son propre Caddy/ })).toBeDisabled()
  await expect(page.getByRole('radio', { name: /Avec le Caddy de n8n/ })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByText('status.203-0-113-10.sslip.io')).toBeVisible()
  await expect(page.getByText('Ports déjà pris sur le serveur : 80, 443.')).toBeVisible()
  await expect(page.getByText('Le pare-feu du serveur (ufw) ferme les ports 80, 443')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ouvrir 80 et 443' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Installer' })).toBeEnabled()
  expect(await settledAxeIssues(page)).toEqual([])
})

test('installed: services with their 90 days, alerts, incidents; changes wait for "Save"', async () => {
  const config = {
    title: 'Services de alice', intervalSec: 60, failuresBeforeDown: 3,
    monitors: [
      { id: 'boutique', name: 'Boutique', type: 'http', target: 'https://boutique.example.fr', public: true },
      { id: 'base', name: 'Base PostgreSQL', type: 'tcp', target: '127.0.0.1:5432', public: false }
    ],
    alerts: { ntfy: { server: 'https://ntfy.sh', topic: 'devforge-0123456789abcdef' }, webhook: null }
  }
  const state = { updatedAt: new Date().toISOString(), monitors: {
    boutique: { status: 'up', since: '', fails: 0, lastCheck: '', lastMs: 212, lastError: null },
    base: { status: 'down', since: '', fails: 4, lastCheck: '', lastMs: null, lastError: 'ECONNREFUSED' }
  } }
  const history = { boutique: { [day(0)]: { total: 1440, ok: 1440, ms: 0 }, [day(3)]: { total: 1440, ok: 1300, ms: 0 } } }
  const incidents = [{ id: 'base-1', monitorId: 'base', title: 'Base PostgreSQL indisponible', cause: 'ECONNREFUSED', startedAt: new Date(Date.now() - 3_600_000).toISOString(), resolvedAt: null }]
  const manual = [{ id: 'm1', title: 'Maintenance de la base', body: 'Mise à jour', startedAt: '2026-10-20T08:00:00Z', resolvedAt: '2026-10-20T08:20:00Z' }]
  run = await launch({
    env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' },
    seed: seed({ statusOverview: ['yes', 'status|running', JSON.stringify(config), JSON.stringify(state), JSON.stringify(history), JSON.stringify(incidents), JSON.stringify(manual)].join(SEP) })
  })
  const { page } = run
  await goTo(page, '/status')
  await expect(page.getByText('En ligne', { exact: true })).toBeVisible()
  await expect(page.getByText('https://status.203-0-113-10.sslip.io')).toBeVisible()
  const boutique = page.getByRole('listitem', { name: 'Boutique' })
  await expect(boutique).toContainText('212 ms')
  await expect(boutique.getByRole('img', { name: 'Boutique : disponibilité des 90 derniers jours' })).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'Base PostgreSQL' })).toContainText('en panne · ECONNREFUSED')
  await expect(page.getByText('Base PostgreSQL indisponible')).toBeVisible()
  await expect(page.getByText('Maintenance de la base')).toBeVisible()
  await expect(page.getByLabel('Sujet ntfy')).toHaveValue('devforge-0123456789abcdef')
  expect(await settledAxeIssues(page)).toEqual([])

  // A change is kept until "Save" (nothing sent to the server here)
  await page.getByLabel('Nom public').fill('API')
  await page.getByLabel('Adresse', { exact: true }).fill('https://api.example.fr/health')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()
  await expect(page.getByText('Réglages modifiés, pas encore envoyés au serveur.')).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'API' })).toContainText('https://api.example.fr/health')
  await page.getByRole('button', { name: 'Annuler' }).click()
  await expect(page.getByRole('listitem', { name: 'API' })).toHaveCount(0)
})
