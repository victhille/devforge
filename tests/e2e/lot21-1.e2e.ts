import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** A saved server plus canned outputs: the pages run without a real VPS */
const vps = (dir: string) => {
  writeFileSync(
    join(dir, 'ssh-connections.json'),
    JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }])
  )
  writeFileSync(
    join(dir, 'vps.json'),
    JSON.stringify({
      services: [
        'portainer|portainer/portainer-ce:2.45.1|8000/tcp, 9443/tcp, 127.0.0.1:9000->9000/tcp|running|Up 2 weeks',
        'dbadmin|phpmyadmin:5.2.3|127.0.0.1:8080->80/tcp|running|Up 2 weeks',
        'blog|nginx:1.27|0.0.0.0:8081->80/tcp, [::]:8081->80/tcp|running|Up 2 days'
      ].join('\n'),
      health: [
        'yes',
        '20\n0',
        'yes',
        '/dev/sda1 19221248 8661552 10543312 46% /\n/dev/sda1 2490368 344497 2145871 14% /',
        'Mem: 2063572992 1333579776 116891648 44699648 859394048 729993216',
        'tcp 0.0.0.0:22\ntcp 127.0.0.1:9000\nudp 0.0.0.0:51820',
        'port 22\npermitrootlogin without-password\npasswordauthentication no',
        'active',
        '353',
        'portainer|running|Up 2 weeks\n--\n/portainer|0',
        'Images|66.34MB (2%)\nBuild Cache|0B',
        'Ubuntu 24.04.5 LTS\nup 2 weeks'
      ].join('\n@@DF@@\n')
    })
  )
}

/** The update button next to Forgy */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('no update: no button', async () => {
  run = await launch({ settings: { onboarded: true } })
  await expect(run.page.getByRole('button', { name: /Mettre à jour|Téléchargement de la v/ })).toHaveCount(0)
})

test('a new version downloads in a card that shrinks into the title bar, then restarts to update', async () => {
  run = await launch({
    settings: { onboarded: true },
    env: {
      DEVFORGE_TEST_UPDATE: JSON.stringify({
        state: 'downloading',
        version: '2.1.0',
        percent: 40,
        transferred: 52428800,
        total: 131072000,
        bytesPerSecond: 5242880
      })
    }
  })
  const { page } = run
  const card = page.getByRole('region', { name: 'Mise à jour de DevForge' })
  await expect(card.getByRole('heading', { name: 'Téléchargement de la version 2.1.0' })).toBeVisible()
  await expect(card.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40')
  await expect(card).toContainText('50 Mo sur 125 Mo')
  await expect(card).toContainText('encore ≈ 15 s')
  // Shrunk: the pill in the title bar, which opens the card again
  await card.getByRole('button', { name: 'Réduire dans la barre de titre' }).click()
  await expect(card).toHaveCount(0)
  const pill = page.getByRole('button', { name: 'Téléchargement de la v2.1.0… 40 %' })
  // The focus follows: on the pill once shrunk, on the card once opened again
  await expect(pill).toBeFocused()
  await pill.click()
  await expect(card).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Téléchargement de la version 2.1.0' })).toBeFocused()
  await run.close()

  run = await launch({ settings: { onboarded: true }, env: { DEVFORGE_TEST_UPDATE: JSON.stringify({ state: 'ready', version: '2.1.0' }) } })
  const ready = run.page.getByRole('region', { name: 'Mise à jour de DevForge' })
  await expect(ready.getByRole('heading', { name: 'La version 2.1.0 est prête' })).toBeVisible()
  await expect(ready.getByRole('button', { name: 'Redémarrer et mettre à jour' })).toBeEnabled()
  // Later: the card goes, the pill says it is ready
  await ready.getByRole('button', { name: 'Plus tard' }).click()
  await expect(run.page.getByRole('button', { name: 'Redémarrer et mettre à jour' })).toHaveText('Mettre à jour (v2.1.0)')
  expect(await settledAxeIssues(run.page)).toEqual([])
})

test('services of the VPS: web interfaces, the exposed one flagged', async () => {
  run = await launch({ settings: { onboarded: true }, seed: vps, env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' } })
  const { page } = run
  await goTo(page, '/services')
  await expect(page.getByRole('heading', { name: 'Services', level: 1 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Portainer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'phpMyAdmin' })).toBeVisible()
  await expect(page.getByText('Ouvert sur Internet')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Ouvrir' })).toHaveCount(3)
  expect(await settledAxeIssues(page)).toEqual([])
})

test('health of the VPS: updates to install, the command shown before it runs', async () => {
  run = await launch({ settings: { onboarded: true }, seed: vps, env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' } })
  const { page } = run
  await goTo(page, '/health')
  // As in the mock-up: Check again in the header, the checks to fix counted
  await expect(page.getByRole('button', { name: 'Revérifier' })).toBeVisible()
  await expect(page.getByText('À corriger', { exact: true })).toBeVisible()
  await expect(page.getByText('20 mises à jour en attente.')).toBeVisible()
  await expect(page.getByText('Connexion par clé uniquement.')).toBeVisible()
  await expect(page.getByText('353 essais refusés en 24 h, bloqués par fail2ban.')).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  await page.getByRole('button', { name: 'Installer les mises à jour' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('sudo -n env DEBIAN_FRONTEND=noninteractive apt-get update')
  await expect(dialog.getByRole('button', { name: 'Lancer' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Redémarrer le serveur' }).click()
  await expect(page.getByRole('dialog')).toContainText('injoignable une à deux minutes')
})
