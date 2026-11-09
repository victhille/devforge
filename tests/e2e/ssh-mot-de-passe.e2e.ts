import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** A saved server pointed elsewhere: the form says its password must be typed again, and it is forgotten */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a new address asks for the password again and forgets the saved one', async () => {
  run = await launch({
    seed: dir => writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([
      { id: 's1', name: 'vps', host: '203.0.113.10', port: 22, username: 'deploy', authMethod: 'password', passwordEnc: 'chiffre', color: '#4F8EF7', createdAt: '2026-01-01T00:00:00.000Z' }
    ]))
  })
  const { page, userData } = run
  await goTo(page, '/ssh')
  // The row's buttons show on hover, over its right side: the mouse stays on the left
  await page.getByText('deploy@203.0.113.10:22').hover({ position: { x: 4, y: 4 } })
  await page.getByRole('button', { name: 'Modifier la connexion' }).click()
  const dialog = page.getByRole('dialog')
  const password = dialog.locator('input[type="password"]')
  const notice = dialog.getByText('L\'adresse ou l\'utilisateur a changé : saisis à nouveau le mot de passe.', { exact: false })

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

  // Saved with the new host and no password: the old one is gone from the disk
  await dialog.getByLabel('Hôte / IP').fill('198.51.100.7')
  await dialog.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect(page.getByText('deploy@198.51.100.7:22')).toBeVisible()
  const saved = JSON.parse(readFileSync(join(userData, 'ssh-connections.json'), 'utf-8'))
  expect(saved).toEqual([expect.objectContaining({ id: 's1', host: '198.51.100.7' })])
  expect(saved[0]).not.toHaveProperty('passwordEnc')
})
