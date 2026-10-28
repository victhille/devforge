import { expect, test } from '@playwright/test'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** v3.5 lot 6: the greyed rest of a terminal line, accepted with → */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test.skip(process.platform !== 'win32', 'PowerShell')

const seedScripts = (dir: string) => writeFileSync(join(dir, 'package.json'), JSON.stringify({ scripts: { dev: 'vite', build: 'vite build' } }))

async function openTerminal(r: Launched) {
  await r.page.getByRole('button', { name: 'Terminal' }).first().click()
  const dock = r.page.getByRole('region', { name: 'Terminal' })
  const input = dock.getByRole('textbox', { name: 'Commande' })
  await expect(input).toBeEnabled({ timeout: 20_000 })
  return { dock, input }
}

test('the project scripts, then the history, complete the line; → accepts it', async () => {
  run = await launch({ seed: seedScripts })
  const { page } = run
  const { dock, input } = await openTerminal(run)
  const ghost = dock.getByTestId('terminal-suggestion')

  // A script of the folder the shell is in
  await input.pressSequentially('npm run d')
  await expect(ghost).toHaveText('ev')
  await input.press('ArrowRight')
  await expect(input).toHaveValue('npm run dev')
  await expect(ghost).toHaveCount(0)
  await input.fill('')

  // A command run before comes back from the history
  await input.fill('Write-Output "salut DevForge"')
  await input.press('Enter')
  await expect(dock.getByRole('article', { name: 'Write-Output "salut DevForge"' })).toContainText('salut DevForge', { timeout: 20_000 })
  await expect(input).toBeEnabled()
  await input.pressSequentially('Write-O')
  await expect(ghost).toHaveText('utput "salut DevForge"')
  expect(await settledAxeIssues(page)).toEqual([])
  // Typing on changes it; something else makes it go
  await input.pressSequentially('x')
  await expect(ghost).toHaveCount(0)
})

test('no suggestion once turned off in Settings', async () => {
  run = await launch({ seed: seedScripts, settings: { terminalSuggest: false } })
  const { dock, input } = await openTerminal(run)
  await input.pressSequentially('npm run d')
  await expect(input).toHaveValue('npm run d')
  await expect(dock.getByTestId('terminal-suggestion')).toHaveCount(0)
  await expect(dock.getByText('accepter la suggestion')).toHaveCount(0)
})
