import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** v2.1 lot 5: the Automations widget on Home, read from a Automations-like cache */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SAMPLE = [
  { uid: 'briefing:2026-10-23', type: 'briefing', titre: 'Briefing du 23 octobre', gravite: 'info', lu: 1, date: '2026-10-23T04:30:00.000Z' },
  { uid: 'mail:1', type: 'mail', titre: 'Facture EDF', gravite: 'attention', lu: 0, date: '2026-10-23T07:00:00.000Z' },
  { uid: 'abonnement:netflix', type: 'abonnement_alerte', titre: 'Netflix se renouvelle dans 3 jours', gravite: 'urgent', lu: 0, date: '2026-10-23T06:00:00.000Z' },
  { uid: 'x:1', type: 'meteo', titre: 'Type inconnu', gravite: 'info', lu: 0, date: '2026-10-21T06:00:00.000Z' }
]
const makeDb = (path: string) => execFileSync(process.execPath, [join(__dirname, 'makeAutomationsDb.mjs'), path, JSON.stringify(SAMPLE)], { stdio: 'ignore' })

test('the Automations widget shows what each automation published and the unread count', async () => {
  run = await launch({
    settings: { onboarded: true, motion: 'reduced', homeWidgets: [{ id: 'automations', size: 'full' }] },
    seed: dir => makeDb(join(dir, 'automations.db')),
    env: { DEVFORGE_TEST_AUTOMATIONS_DB: '{userData}/automations.db' }
  })
  const { page } = run
  await goTo(page, '/')
  const w = page.locator('[data-widget=automations]')
  await expect(w).toContainText('Automatisations (Automations)')
  await expect(w).toContainText('3 non lu(s)')
  await expect(w).toContainText('Briefing du matin')
  await expect(w).toContainText('Abonnements')
  await expect(w).toContainText('Autres')
  // No birthday item yet: that automation is not listed
  await expect(w).not.toContainText('Anniversaires')
})

test('the widget can be added from Customize', async () => {
  run = await launch({ settings: { onboarded: true, motion: 'reduced' }, env: { DEVFORGE_TEST_AUTOMATIONS_DB: '{userData}/none.db' } })
  const { page } = run
  await goTo(page, '/')
  await page.getByRole('button', { name: 'Personnaliser' }).click()
  await page.getByRole('combobox', { name: 'Ajouter un widget' }).selectOption({ label: 'Automatisations (Automations)' })
  await page.getByRole('button', { name: 'Terminé' }).click()
  await expect(page.locator('[data-widget=automations]')).toContainText(/Automations (n'est pas installé|n'a encore rien reçu)/)
})
