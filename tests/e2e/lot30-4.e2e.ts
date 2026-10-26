import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.0 lot 4: export, erase everything (back to the welcome screen), import (paths in place of the dialogs, a reload in place of the restart) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('export without secrets, erase everything, import the setup back', async () => {
  let shop = ''
  run = await launch({
    // export.json is not part of the data: erasing leaves it, the import reads it back
    env: { DEVFORGE_TEST_EXPORT_PATH: '{userData}/export.json', DEVFORGE_TEST_IMPORT_PATH: '{userData}/export.json', DEVFORGE_TEST_NO_RELAUNCH: '1', GIT_CONFIG_GLOBAL: '{userData}/gitconfig' },
    seed: dir => {
      shop = join(dir, 'shop')
      mkdirSync(shop)
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'shop', path: shop, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
      writeFileSync(join(dir, 'ssh-connections.json'), JSON.stringify([{ id: 's1', name: 'vps', host: '203.0.113.10', port: 22, username: 'deploy', authMethod: 'password', passwordEnc: 'chiffre' }]))
    }
  })
  const { page, userData } = run
  const exported = join(userData, 'export.json')
  page.on('dialog', d => d.accept())

  await goTo(page, '/settings?section=data')
  expect(await settledAxe(page)).toEqual([])
  await page.getByRole('button', { name: 'Exporter' }).click()
  await expect(page.getByText('Configuration exportée.')).toBeVisible()
  const bundle = readFileSync(exported, 'utf-8')
  expect(bundle).toContain('"shop"')
  expect(bundle).toContain('203.0.113.10')
  expect(bundle).not.toContain('chiffre')
  expect(bundle).not.toContain('passwordEnc')

  // Erasing needs the word typed
  const wipe = page.getByRole('button', { name: 'Tout effacer' })
  await expect(wipe).toBeDisabled()
  await page.getByLabel('Tape « effacer » pour confirmer').fill('effacer')
  await wipe.click()
  await expect(page.getByRole('dialog', { name: /Bienvenue dans DevForge|Welcome to DevForge/ })).toBeVisible({ timeout: 20_000 })
  expect(existsSync(join(userData, 'projects.json'))).toBe(false)
  expect(existsSync(join(userData, 'ssh-connections.json'))).toBe(false)
  expect(existsSync(shop)).toBe(true)

  // Import: the projects and the server come back, the password does not
  await page.getByRole('button', { name: /Passer|Skip/ }).click()
  await goTo(page, '/settings?section=data')
  await page.getByRole('button', { name: /Importer|Import/ }).click()
  await expect.poll(() => existsSync(join(userData, 'projects.json'))).toBe(true)
  expect(JSON.parse(readFileSync(join(userData, 'projects.json'), 'utf-8'))[0].name).toBe('shop')
  const servers = JSON.parse(readFileSync(join(userData, 'ssh-connections.json'), 'utf-8'))
  expect(servers[0]).toMatchObject({ name: 'vps', host: '203.0.113.10' })
  expect(servers[0].passwordEnc).toBeUndefined()
})
