import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** The Online pages after the mock-up: deploy, n8n and VPN (canned server answers, no real VPS) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SEP = '\n@@DF@@\n'
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString()

function seed(write: (dir: string) => void) {
  return (dir: string) => {
    writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '203.0.113.10', port: 1, username: 'ubuntu', authMethod: 'privateKey', color: '', createdAt: '' }]))
    write(dir)
  }
}

test('deploy: the last run with its steps and log, the targets in a table', async () => {
  const script = 'git pull\nnpm ci\nnpm run build\npm2 reload ecosystem.config.js'
  run = await launch({
    settings: { onboarded: true },
    seed: seed(dir => writeFileSync(join(dir, 'deploy.json'), JSON.stringify({
      targets: [
        { id: 't1', name: 'boutique', connectionId: 'v1', remotePath: '/srv/boutique', script, pushFirst: false },
        { id: 't2', name: 'portfolio', connectionId: 'v1', remotePath: '/var/www/portfolio', script: 'git pull\nnpm run build', pushFirst: false }
      ],
      runs: [{ id: 'r1', targetId: 't1', status: 'failed', startedAt: ago(90), finishedAt: ago(89), exitCode: 1, log: '$ git pull\nok\n$ npm ci\nERR! ENOSPC\n\n▸ exit code 1\n' }]
    })))
  })
  const { page } = run
  await goTo(page, '/deploy')
  await expect(page.getByRole('heading', { name: 'boutique → Prod' })).toBeVisible()
  // One step per line of the script, read in the log: done, failed, then to come
  const steps = page.getByRole('list', { name: 'Étapes' }).getByRole('listitem')
  await expect(steps).toHaveCount(4)
  await expect(steps.nth(0)).toContainText('Récupération · faite')
  await expect(steps.nth(1)).toContainText('Installation · en échec')
  await expect(steps.nth(2)).toContainText('Build · à venir')
  await expect(page.getByRole('region', { name: 'Journal du déploiement de boutique' })).toContainText('ERR! ENOSPC')
  // The table: method, last deploy, the actions of a row
  const row = page.getByRole('row', { name: /boutique/ })
  await expect(row).toContainText('Node.js · PM2')
  await expect(row).toContainText('échec')
  await expect(page.getByRole('row', { name: /portfolio/ })).toContainText('jamais déployée')
  await row.getByRole('button', { name: 'Autres actions sur boutique' }).click()
  await expect(page.getByRole('menuitem', { name: 'Modifier' })).toBeVisible()
  await page.keyboard.press('Escape')
  expect(await settledAxeIssues(page)).toEqual([])

  // The editor fills the window, whatever the height of the page under it
  await page.getByRole('button', { name: 'Nouvelle cible' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle cible de déploiement' })
  await expect(dialog.getByRole('button', { name: 'Docker Compose' })).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box!.height).toBeGreaterThan(400)
})

test('n8n: its state and version, the counts of the day, the workflows with their trigger', async () => {
  run = await launch({
    settings: { onboarded: true },
    env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' },
    seed: seed(dir => {
      writeFileSync(join(dir, 'n8n.json'), JSON.stringify({ instances: [{ connectionId: 'v1', domain: 'n8n.example.com', exposure: 'caddy', installedAt: '2026-10-01T10:00:00Z', locale: 'fr', keyEnc: 'canned' }] }))
      writeFileSync(join(dir, 'vps.json'), JSON.stringify({
        n8nStatus: ['yes', 'n8n|running|Up 2 days\npostgres|running|Up 2 days', '1.82.1'].join(SEP),
        n8nApi: {
          'GET /workflows': { data: [
            { id: 'w1', name: 'Nouvelle commande', active: true, updatedAt: ago(3000), nodes: [{ name: 'Webhook', type: 'n8n-nodes-base.webhook' }] },
            { id: 'w2', name: 'Relance des factures', active: true, updatedAt: ago(9000), nodes: [{ name: 'Chaque jour', type: 'n8n-nodes-base.scheduleTrigger' }] },
            { id: 'w3', name: 'Veille des prix', active: false, updatedAt: '2026-11-02T10:00:00Z', nodes: [{ name: 'Toutes les 6 h', type: 'n8n-nodes-base.scheduleTrigger' }] }
          ], nextCursor: null },
          'GET /executions': { data: [
            { id: '3', workflowId: 'w1', status: 'success', startedAt: ago(4), mode: 'webhook' },
            { id: '4', workflowId: 'w2', status: 'error', startedAt: ago(60), mode: 'trigger' },
            { id: '2', workflowId: 'w2', status: 'error', startedAt: ago(300), mode: 'trigger' },
            { id: '1', workflowId: 'w1', status: 'success', startedAt: ago(600), mode: 'webhook' }
          ] }
        }
      }))
    })
  })
  const { page } = run
  await goTo(page, '/n8n')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('en ligne · 1.82.1')
  await expect(page.getByRole('button', { name: 'Ouvrir n8n' })).toBeVisible()
  await expect(page.getByText('Workflows actifs').locator('..')).toContainText('2sur 3')
  await expect(page.getByText('Exécutions · 24 h').locator('..')).toContainText('4')
  await expect(page.getByText('Échecs · 24 h').locator('..')).toContainText('2')
  await expect(page.getByText('Webhook public').locator('..')).toContainText('n8n.example.com')
  const first = page.getByRole('row', { name: /Nouvelle commande/ })
  await expect(first).toContainText('webhook')
  await expect(first).toContainText('réussie')
  await expect(page.getByRole('row', { name: /Relance des factures/ })).toContainText('planifié')
  await expect(page.getByRole('row', { name: /Veille des prix/ })).toContainText('en pause depuis le')
  await expect(page.getByRole('switch', { name: 'Activer Veille des prix' })).toHaveAttribute('aria-checked', 'false')
  // Two failures: listed below the table (one alone is already in it)
  await expect(page.getByRole('list', { name: 'Échecs des dernières 24 h' }).getByRole('listitem')).toHaveCount(2)
  expect(await settledAxeIssues(page)).toEqual([])
})

test('VPN: the devices in a table, the QR code of the one picked beside them', async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#fff"/><rect width="2" height="2"/></svg>'
  run = await launch({
    settings: { onboarded: true },
    env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' },
    seed: seed(dir => {
      writeFileSync(join(dir, 'vpn.json'), JSON.stringify({ servers: [{ connectionId: 'v1', port: 51821, username: 'admin', passwordEnc: 'canned' }] }))
      writeFileSync(join(dir, 'vps.json'), JSON.stringify({
        vpnDetect: 'wg-easy|ghcr.io/wg-easy/wg-easy:15|0.0.0.0:51820->51820/udp, 127.0.0.1:51821->51821/tcp',
        vpnApi: {
          'GET /client': [
            { id: 1, name: 'Téléphone de Camille', enabled: true, ipv4Address: '10.8.0.2', latestHandshakeAt: ago(1), transferRx: 22_000_000, transferTx: 190_000_000 },
            { id: 2, name: 'Ancien PC', enabled: false, ipv4Address: '10.8.0.4', latestHandshakeAt: null, transferRx: null, transferTx: null }
          ],
          'GET /client/1/qrcode.svg': svg
        }
      }))
    })
  })
  const { page } = run
  await goTo(page, '/vpn')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('WireGuard actif')
  await expect(page.getByText('Le WireGuard de ton VPS, géré par wg-easy. 2 appareils.')).toBeVisible()
  const phone = page.getByRole('row', { name: /Téléphone de Camille/ })
  await expect(phone).toContainText('connecté')
  await expect(page.getByRole('row', { name: /Ancien PC/ })).toContainText('jamais connecté')
  await expect(page.getByText('Choisis un appareil pour afficher son code QR.')).toBeVisible()
  await phone.click()
  await expect(page.getByRole('img', { name: 'Téléphone de Camille · QR code' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Télécharger le fichier .conf' })).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])
})
