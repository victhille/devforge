import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** A saved server pointed elsewhere: the form says what it kept will be asked again, and it is forgotten */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a new address forgets the saved password and what was kept for the server', async () => {
  run = await launch({
    seed: dir => {
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([
        { id: 's1', name: 'vps', host: '203.0.113.10', port: 22, username: 'deploy', authMethod: 'password', passwordEnc: 'chiffre', color: '#4F8EF7', createdAt: '2026-01-01T00:00:00.000Z' }
      ]))
      writeFileSync(join(dir, 'n8n.json'), JSON.stringify({ instances: [{ connectionId: 's1', domain: '', exposure: 'port', installedAt: '2026-01-01T00:00:00.000Z', keyEnc: 'chiffre' }] }))
      writeFileSync(join(dir, 'vpn.json'), JSON.stringify({ servers: [{ connectionId: 's1', port: 51821, username: 'admin', passwordEnc: 'chiffre' }] }))
    }
  })
  const { page, app, userData } = run
  const read = (name: string) => JSON.parse(readFileSync(join(userData, name), 'utf-8'))
  // Below 760 px the server list folds to initials, without its edit button (the CI's window is smaller)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1440, 900))
  await goTo(page, '/ssh')
  // The row's buttons show on hover, over its right side: the mouse stays on the left
  await page.getByText('deploy@203.0.113.10:22').hover({ position: { x: 4, y: 4 } })
  await page.getByRole('button', { name: 'Modifier la connexion' }).click()
  const dialog = page.getByRole('dialog')
  const password = dialog.locator('input[type="password"]')
  const notice = dialog.getByRole('status').filter({ hasText: 'L\'hôte, le port ou l\'utilisateur a changé' })

  // Same address: an empty field keeps the password
  await expect(password).toHaveAttribute('placeholder', 'Laisser vide pour garder le mot de passe actuel')
  await expect(notice).toHaveCount(0)

  // Another host: the form says so, and the server key shown is no longer the old server's
  await dialog.getByLabel('Hôte / IP').fill('198.51.100.7')
  await expect(notice).toBeVisible()
  await expect(password).toHaveAttribute('placeholder', '••••••••')
  await expect(dialog.getByText('Mémorisée à la première connexion')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])

  // Back to the same host, then another username
  await dialog.getByLabel('Hôte / IP').fill('203.0.113.10')
  await expect(notice).toHaveCount(0)
  await dialog.getByLabel("Nom d'utilisateur").fill('root')
  await expect(notice).toBeVisible()
  await dialog.getByLabel("Nom d'utilisateur").fill('deploy')

  // A host the server could not be reached at is refused in the form
  await dialog.getByLabel('Hôte / IP').fill('root@198.51.100.7')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(dialog.getByText('Un nom ou une adresse IP, sans espace ni @')).toBeVisible()

  // Saved with the new host and no password: the old one is gone from the disk, n8n's key and the VPN login too
  await dialog.getByLabel('Hôte / IP').fill('198.51.100.7')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('deploy@198.51.100.7:22')).toBeVisible()
  const saved = read('ssh-connections.json')
  expect(saved).toEqual([expect.objectContaining({ id: 's1', host: '198.51.100.7' })])
  expect(saved[0]).not.toHaveProperty('passwordEnc')
  expect(read('n8n.json').instances).toEqual([expect.not.objectContaining({ keyEnc: expect.anything() })])
  expect(read('vpn.json').servers).toEqual([])
})
