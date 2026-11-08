import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'

/** A key typed by hand in the .env editor: only a name the file can hold is written */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('a new key that starts with a digit cannot be added; a valid one is written and the fields empty', async () => {
  let app = ''
  run = await launch({
    settings: { onboarded: true, motion: 'reduced' },
    seed: dir => {
      app = join(dir, 'shop')
      mkdirSync(app)
      writeFileSync(join(app, '.env'), 'A=1\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'p1', name: 'Shop', path: app, framework: 'nextjs', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }]))
    }
  })
  const { page } = run
  await goTo(page, '/env-files')
  await page.getByRole('button', { name: /Shop/ }).click()

  const key = page.getByRole('textbox', { name: 'Nouvelle clé' })
  const value = page.getByRole('textbox', { name: 'Valeur' })
  const add = page.getByRole('button', { name: 'Ajouter', exact: true })
  await key.fill('1api url')
  await expect(key).toHaveValue('1API_URL')
  await value.fill('https://example.com')
  await expect(add).toBeDisabled()

  await key.fill('api url')
  await expect(add).toBeEnabled()
  await add.click()
  await expect(key).toHaveValue('')
  await expect(value).toHaveValue('')
  expect(readFileSync(join(app, '.env'), 'utf-8')).toBe('A=1\nAPI_URL=https://example.com\n')
})
