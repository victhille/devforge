import { expect, test } from '@playwright/test'
import { launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** v2.2 lot 5: the terminal in blocks, with a real PowerShell */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test.skip(process.platform !== 'win32', 'PowerShell')

test('blocks with their exit code, history, Forgy explains a failure', async () => {
  run = await launch()
  const { page } = run
  await page.getByRole('button', { name: 'Terminal' }).first().click()
  const dock = page.getByRole('region', { name: 'Terminal' })
  const input = dock.getByRole('textbox', { name: 'Commande' })
  await expect(input).toBeEnabled({ timeout: 20_000 })

  await input.fill('Write-Output "bonjour depuis DevForge"')
  await input.press('Enter')
  const ok = dock.getByRole('article', { name: 'Write-Output "bonjour depuis DevForge"' })
  await expect(ok).toContainText('bonjour depuis DevForge', { timeout: 20_000 })
  await expect(ok.getByLabel('Réussie (code 0)')).toBeVisible()
  // The echo of the command is not part of the output
  await expect(ok.locator('pre')).not.toContainText('Write-Output')

  await expect(input).toBeEnabled()
  await input.fill('cmd /c "echo oups 1>&2 & exit 3"')
  await input.press('Enter')
  const failed = dock.getByRole('article', { name: 'cmd /c "echo oups 1>&2 & exit 3"' })
  await expect(failed.getByLabel('Échec (code 3)')).toBeVisible({ timeout: 20_000 })
  await expect(failed).toContainText('oups')
  expect(await settledAxeIssues(page)).toEqual([])

  // History: the last command comes back with ↑
  await expect(input).toBeEnabled()
  await input.press('ArrowUp')
  await expect(input).toHaveValue('cmd /c "echo oups 1>&2 & exit 3"')
  await input.fill('')

  // Forgy gets the command, the code and the output
  await failed.getByRole('button', { name: 'Expliquer avec Forgy' }).last().click()
  await expect(page.getByText('Code de retour : 3')).toBeVisible()
})
