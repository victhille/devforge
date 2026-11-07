import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v2.1 lot 2: nightly backups (canned server outputs, no real VPS) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SEP = '\n@@DF@@\n'
const candidates = [
  '/n8n-postgres-1|postgres:16-alpine|volume:n8n_postgres_data;',
  '/wg-easy|ghcr.io/wg-easy/wg-easy:15.2.2|volume:wg-easy_etc_wireguard;bind:/lib/modules;',
  '/portainer|portainer/portainer-ce:2.45.1|bind:/opt/utils/docker/_data/portainer;'
].join('\n') + SEP + '/lib/modules\n/opt/utils/docker/_data/portainer'

const seed = (withPlan: boolean) => (dir: string) => {
  writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
  const finished = new Date(Date.now() - 3 * 3_600_000).toISOString()
  const status = { version: 1, day: '2026-10-22', startedAt: finished, finishedAt: finished, ok: true, size: 1_234_567, items: [] }
  writeFileSync(join(dir, 'vps.json'), JSON.stringify({
    backupCandidates: candidates,
    backupState: [withPlan ? JSON.stringify(status) : '', withPlan ? '1' : '0', 'daily/2026-10-22/db-n8n-postgres-1.sql.gz|600000\ndaily/2026-10-22/vol-wg-easy_etc_wireguard.tar.gz|4000'].join(SEP)
  }))
  if (withPlan) writeFileSync(join(dir, 'backups.json'), JSON.stringify({ plans: [{ connectionId: 'v1', databases: [{ engine: 'postgres', container: 'n8n-postgres-1' }], volumes: ['wg-easy_etc_wireguard'], time: '03:30', keepDaily: 7, keepWeekly: 4, localDir: '', savedAt: finished }], copies: [] }))
}

test('first setup: databases and data picked by default, a database volume left out', async () => {
  run = await launch({ settings: { onboarded: true }, seed: seed(false), env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' } })
  const { page } = run
  await goTo(page, '/backups')
  await expect(page.getByRole('heading', { name: 'Activer les sauvegardes' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /n8n-postgres-1/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /wg-easy_etc_wireguard/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /\/opt\/utils\/docker\/_data\/portainer/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /n8n_postgres_data/ })).not.toBeChecked()
  await expect(page.getByText("données d'une base : déjà couvertes par son export")).toBeVisible()
  await expect(page.getByRole('checkbox', { name: /lib\/modules/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Activer les sauvegardes' })).toBeEnabled()
})

test('with a plan: last night, the files, a restore asks first', async () => {
  run = await launch({ settings: { onboarded: true }, seed: seed(true), env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' } })
  const { page } = run
  await goTo(page, '/backups')
  await expect(page.getByRole('heading', { name: 'Dernière sauvegarde' })).toBeVisible()
  await expect(page.getByText(/^Réussie .* · 1\.2 MB$/)).toBeVisible()
  await expect(page.getByText('Chaque nuit à 03:30 · 7 jours, 4 semaines')).toBeVisible()
  await expect(page.getByText('db-n8n-postgres-1.sql.gz')).toBeVisible()
  await page.getByRole('button', { name: 'Restaurer' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Restaurer n8n-postgres-1 ?' })
  await expect(dialog).toContainText('pre-restore/')
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toHaveCount(0)
})
