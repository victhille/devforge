import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** v2.3 lot 2: cmd's exit codes, and the project page's shells kept across tabs (real cmd) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test.skip(process.platform !== 'win32', 'cmd')

test('cmd blocks get their exit code, and the shell is still there after another tab', async () => {
  run = await launch({
    seed: data => {
      const dir = join(data, 'outil')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'package.json'), '{"name":"outil"}')
      writeFileSync(join(data, 'projects.json'), JSON.stringify([
        { id: 'o', name: 'outil', path: dir, framework: 'nodejs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
    }
  })
  const { page } = run
  await goTo(page, '/project/o?tab=terminal')
  const tabs = page.getByRole('toolbar', { name: 'Terminaux' })
  await tabs.getByRole('button', { name: 'Nouveau terminal' }).click()
  await page.getByRole('menuitem', { name: 'cmd' }).click()
  const shell = page.getByRole('group', { name: 'cmd' })
  const input = shell.getByRole('textbox', { name: 'Commande' })
  await expect(input).toBeEnabled({ timeout: 20_000 })

  await input.fill('echo bonjour cmd')
  await input.press('Enter')
  const ok = shell.getByRole('article', { name: 'echo bonjour cmd' })
  await expect(ok.getByLabel('Réussie (code 0)')).toBeVisible({ timeout: 20_000 })
  // DevForge's suffix stays out of sight
  await expect(ok).not.toContainText('call prompt')

  await expect(input).toBeEnabled()
  await input.fill('cmd /c exit 3')
  await input.press('Enter')
  await expect(shell.getByRole('article', { name: 'cmd /c exit 3' }).getByLabel('Échec (code 3)')).toBeVisible({ timeout: 20_000 })
  expect(await settledAxeIssues(page)).toEqual([])

  // Another tab and back: same shell, same blocks
  await page.getByRole('tab', { name: 'Git' }).click()
  await expect(shell).toBeHidden()
  await page.getByRole('tab', { name: 'Terminal' }).click()
  await expect(shell.getByRole('article', { name: 'echo bonjour cmd' })).toBeVisible()
  await expect(input).toBeEnabled()
})
