import { expect, test } from '@playwright/test'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5 lot 4: each tool says what it is for and loads examples, which save and send nothing */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('the tools explain themselves and load examples that save and send nothing', async () => {
  run = await launch()
  const { page } = run
  const help = page.getByRole('complementary', { name: "Aide de l'outil" })

  // Toolbox: every tab has its help
  await goTo(page, '/toolbox')
  for (const tab of ['JSON', 'Base64', 'JWT', 'Regex', 'UUID', 'Hash', 'Cron', 'Timestamp', 'URL']) {
    await page.getByRole('tab', { name: tab, exact: true }).click()
    await expect(help).toBeVisible()
  }
  // Regex: a model fills the pattern and the text
  await page.getByRole('tab', { name: 'Regex', exact: true }).click()
  await help.getByRole('button', { name: 'Date jj/mm/aaaa' }).click()
  await expect(page.getByText('2 correspondances')).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
  // The help hides, and stays hidden
  await help.getByRole('button', { name: "Masquer l'aide" }).click()
  await page.getByRole('tab', { name: 'JSON', exact: true }).click()
  await page.getByRole('tab', { name: 'Regex', exact: true }).click()
  await expect(help).toHaveCount(0)
  await page.getByRole('button', { name: 'Aide', exact: true }).click()
  await expect(help).toBeVisible()

  // Snippets: the example is not saved until the user starts from it
  await goTo(page, '/snippets')
  await expect(page.getByLabel('Exemple de snippet')).toContainText('getJson')
  expect(await page.evaluate(() => localStorage.getItem('devforge:snippets'))).toBe('[]')
  await page.getByRole('button', { name: 'Partir de cet exemple' }).click()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('devforge:snippets') ?? '[]').length)).toBe(1)

  // Diff: two texts to compare
  await goTo(page, '/diff')
  await help.getByRole('button', { name: 'Deux .env' }).click()
  await expect(page.getByText(/\+4 /)).toBeVisible()

  // Webhooks: an example request, with nothing to send
  await goTo(page, '/webhooks')
  await help.getByRole('button', { name: 'Un paiement Stripe' }).click()
  await expect(page.getByRole('note')).toContainText('.invalid')
  await expect(page.getByRole('button', { name: 'Envoyer' })).toBeDisabled()
  expect(await settledAxe(page)).toEqual([])
})
