import { expect, test } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.7 lot 1: the Tests tab (a stand-in "vitest" writes a real-format report) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }

/** A "vitest" that prints a few lines and writes its JSON report where it is told */
const FAKE_VITEST = `
const fs = require('fs'), path = require('path')
const out = process.argv.find(a => a.startsWith('--outputFile.json='))?.split('=')[1]
const root = process.cwd()
const only = process.argv.slice(2).filter(a => !a.startsWith('-') && a !== 'run')
console.log(' RUN  v3.2.7 ' + root)
console.log(' ✓ src/format.test.ts (2 tests)')
console.log(' ❯ src/cart.test.ts (3 tests | 1 failed)')
const files = [
  { name: path.join(root, 'src', 'cart.test.ts'), assertionResults: [
    { ancestorTitles: ['cart'], title: 'adds the items', status: 'passed', duration: 4, failureMessages: [] },
    { ancestorTitles: ['cart'], title: 'applies the discount', status: 'failed', duration: 7, failureMessages: ['AssertionError: expected 90 to be 85 // Object.is equality\\n    at ' + path.join(root, 'src', 'cart.test.ts') + ':6:51'] },
    { ancestorTitles: ['cart'], title: 'later', status: 'skipped', duration: 0, failureMessages: [] }
  ] },
  { name: path.join(root, 'src', 'format.test.ts'), assertionResults: [
    { ancestorTitles: [], title: 'formats a price', status: 'passed', duration: 2, failureMessages: [] },
    { ancestorTitles: [], title: 'formats a date', status: 'passed', duration: 1, failureMessages: [] }
  ] }
].filter(f => !only.length || only.some(o => f.name.replace(/\\\\/g, '/').endsWith(o)))
fs.writeFileSync(out, JSON.stringify({ testResults: files }))
process.exit(files.some(f => f.assertionResults.some(a => a.status === 'failed')) ? 1 : 0)
`

test('the Tests tab runs the tools, shows each test by file, keeps the last run', async () => {
  run = await launch({
    seed: dir => {
      const shop = join(dir, 'shop')
      file(join(shop, 'package.json'), JSON.stringify({ name: 'shop', devDependencies: { vitest: '^3.2.0' } }))
      file(join(shop, 'node_modules', '.bin', 'fake-vitest.js'), FAKE_VITEST)
      file(join(shop, 'node_modules', '.bin', 'vitest.cmd'), '@node "%~dp0fake-vitest.js" %*\r\n')
      file(join(shop, 'node_modules', '.bin', 'vitest'), '#!/bin/sh\nnode "$(dirname "$0")/fake-vitest.js" "$@"\n')
      // pytest without a virtual environment: listed, with what is missing
      file(join(shop, 'requirements-dev.txt'), 'pytest\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p', name: 'shop', path: shop, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/project/p')
  await page.getByRole('tab', { name: 'Tests' }).click()

  await page.getByRole('button', { name: 'Lancer les tests (Vitest)' }).click()
  const files = page.getByTestId('test-files')
  await expect(files).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Réussis', { exact: true }).locator('..')).toContainText('3')
  await expect(page.getByText('Échoués', { exact: true }).locator('..')).toContainText('1')
  await expect(page.getByText('Ignorés', { exact: true }).locator('..')).toContainText('1')

  // The failed file is open, the other folded
  const cart = files.getByTestId('test-file').filter({ hasText: 'src/cart.test.ts' })
  await expect(cart).toContainText('cart › applies the discount')
  await expect(cart).toContainText('1 échoué(s) · 1 ignoré(s) · 3 test(s)')
  const format = files.getByTestId('test-file').filter({ hasText: 'src/format.test.ts' })
  await expect(format).not.toContainText('formats a price')
  await format.getByRole('button', { name: /src\/format\.test\.ts/ }).click()
  await expect(format).toContainText('formats a price')

  // The command's output
  await page.getByText(/^Sortie de la commande/).click()
  await expect(page.getByRole('region', { name: 'Sortie des tests' }).or(page.getByLabel('Sortie des tests'))).toContainText('src/cart.test.ts (3 tests | 1 failed)')
  expect(await settledAxe(page)).toEqual([])

  // pytest is offered, with what it lacks
  await page.getByRole('combobox', { name: 'Outil de test' }).selectOption('pytest')
  await expect(page.getByRole('status').filter({ hasText: '.venv manque' })).toContainText('python -m venv .venv')
  await expect(page.getByRole('button', { name: 'Lancer les tests (pytest)' })).toBeDisabled()

  // Back on the page later: the last run is still there
  await page.reload()
  await expect(page.getByText(/^Dernière exécution/)).toBeVisible()
  await expect(page.getByTestId('test-files')).toContainText('src/cart.test.ts')
})
