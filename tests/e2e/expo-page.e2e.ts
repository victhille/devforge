import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'
import { acceptConfirms } from './confirm'
import { writeFakeExpo } from './fakeExpo'

/** Development › Expo: the apps found, a Metro server (a local stand-in), the QR code and the keys */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('the Expo page finds the apps of a monorepo, serves one with its QR code, sends keys and aligns versions', async () => {
  let fake = ''
  run = await launch({
    settings: { onboarded: true },
    env: { DEVFORGE_TEST_EXPO_CMD: '{userData}/fake-expo.cjs' },
    seed: dir => {
      fake = writeFakeExpo(dir)
      const mono = join(dir, 'freelance')
      const mobile = join(mono, 'apps', 'mobile')
      mkdirSync(mobile, { recursive: true })
      writeFileSync(join(mono, 'package.json'), JSON.stringify({ name: 'freelance', dependencies: { turbo: '2.0.0' } }))
      writeFileSync(join(mobile, 'package.json'), JSON.stringify({ name: 'mobile', dependencies: { expo: '~54.0.0', 'expo-router': '6.0.0' } }))
      writeFileSync(
        join(dir, 'projects.json'),
        JSON.stringify([
          { id: 'p1', name: 'freelance', path: mono, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }
        ])
      )
    }
  })
  expect(fake).toContain('fake-expo.cjs')
  const { page } = run
  await acceptConfirms(page)
  await goTo(page, '/expo')

  await expect(page.getByRole('heading', { name: 'Expo', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: /mobile.*freelance\/apps\/mobile.*SDK 54/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/Le serveur est arrêté/)).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  // Start on port 8082: the QR code holds Metro's address
  const port = page.getByRole('textbox', { name: 'Port' })
  await port.fill('8082')
  await page.getByRole('button', { name: 'Démarrer' }).click()
  await expect(page.getByRole('img', { name: 'QR code de exp://192.168.1.71:8082' })).toBeVisible()
  await expect(page.getByText('En marche · port 8082')).toBeVisible()
  await expect(port).toBeDisabled()

  // Keys go to Expo's terminal
  await page.getByRole('button', { name: /Recharger l’appli/ }).click()
  await expect(page.getByText('› Reloading apps')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Demander à Forgy d’expliquer l’erreur' })).toBeVisible()
  expect(await settledAxeIssues(page)).toEqual([])

  // Versions off the SDK, aligned after a confirmation
  await page.getByRole('button', { name: 'Vérifier' }).click()
  await expect(page.getByText('1 paquet(s) ne suivent pas le SDK 54')).toBeVisible()
  await expect(page.getByText(/react-native-reanimated · 3\.10\.1, attendu ~3\.16\.1/)).toBeVisible()
  await page.getByRole('button', { name: 'Aligner les versions' }).click()
  await expect(page.getByText('Tous les paquets suivent le SDK 54.')).toBeVisible()

  await page.getByRole('button', { name: 'Arrêter' }).click()
  await expect(page.getByText(/Le serveur est arrêté/)).toBeVisible()
})
