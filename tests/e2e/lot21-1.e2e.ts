import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** A saved server plus canned outputs: the pages run without a real VPS */
const vps = (dir: string) => {
  writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 'v1', name: 'Prod', host: '127.0.0.1', port: 1, username: 'root', authMethod: 'privateKey', color: '', createdAt: '' }]))
  writeFileSync(join(dir, 'vps.json'), JSON.stringify({
    services: [
      'portainer|portainer/portainer-ce:2.45.1|8000/tcp, 9443/tcp, 127.0.0.1:9000->9000/tcp|running|Up 2 weeks',
      'dbadmin|phpmyadmin:5.2.3|127.0.0.1:8080->80/tcp|running|Up 2 weeks',
      'blog|nginx:1.27|0.0.0.0:8081->80/tcp, [::]:8081->80/tcp|running|Up 2 days'
    ].join('\n'),
    health: [
      'yes', '20\n0', 'yes',
      '/dev/sda1 19221248 8661552 10543312 46% /\n/dev/sda1 2490368 344497 2145871 14% /',
      'Mem: 2063572992 1333579776 116891648 44699648 859394048 729993216',
      'tcp 0.0.0.0:22\ntcp 127.0.0.1:9000\nudp 0.0.0.0:51820',
      'port 22\npermitrootlogin without-password\npasswordauthentication no',
      'active', '353',
      'portainer|running|Up 2 weeks\n--\n/portainer|0',
      'Images|66.34MB (2%)\nBuild Cache|0B',
      'Ubuntu 24.04.5 LTS\nup 2 weeks'
    ].join('\n@@DF@@\n')
  }))
}

/** v2.1 lot 1: the update button next to Forgy */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('no update: no button', async () => {
  run = await launch({ settings: { onboarded: true } })
  await expect(run.page.getByRole('button', { name: /Mettre à jour|Téléchargement de la v/ })).toHaveCount(0)
})

test('a new version downloads, then the button restarts to update', async () => {
  run = await launch({ settings: { onboarded: true }, env: { DEVFORGE_TEST_UPDATE: JSON.stringify({ state: 'downloading', version: '2.1.0', percent: 40 }) } })
  const downloading = run.page.getByRole('button', { name: 'Téléchargement de la v2.1.0… 40 %' })
  await expect(downloading).toBeVisible()
  await expect(downloading).toBeDisabled()
  await run.close()

  run = await launch({ settings: { onboarded: true }, env: { DEVFORGE_TEST_UPDATE: JSON.stringify({ state: 'ready', version: '2.1.0' }) } })
  const ready = run.page.getByRole('button', { name: 'Redémarrer et mettre à jour' })
  await expect(ready).toBeEnabled()
  await expect(ready).toHaveText('Mettre à jour (v2.1.0)')
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
})

test('health of the VPS: updates to install, the command shown before it runs', async () => {
  run = await launch({ settings: { onboarded: true }, seed: vps, env: { DEVFORGE_TEST_VPS: '{userData}/vps.json' } })
  const { page } = run
  await goTo(page, '/health')
  await expect(page.getByRole('heading', { name: 'À surveiller' })).toBeVisible()
  await expect(page.getByText('20 mises à jour en attente.')).toBeVisible()
  await expect(page.getByText('Connexion par clé uniquement.')).toBeVisible()
  await expect(page.getByText('353 essais refusés en 24 h, bloqués par fail2ban.')).toBeVisible()

  await page.getByRole('button', { name: 'Installer les mises à jour' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('sudo -n env DEBIAN_FRONTEND=noninteractive apt-get update')
  await expect(dialog.getByRole('button', { name: 'Lancer' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Annuler' }).click()
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', { name: 'Redémarrer le serveur' }).click()
  await expect(page.getByRole('dialog')).toContainText('injoignable une à deux minutes')
})
