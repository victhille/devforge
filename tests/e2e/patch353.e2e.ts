import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { settledAxeIssues as settledAxe } from './axe'

/** v3.5.3: Python packages, code in colours, a file opened in the IDE */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }

test('a Python project lists its packages, compared with PyPI, with the command that updates them', async () => {
  run = await launch({
    env: { DEVFORGE_TEST_PACKAGES: '{userData}/packages.json' },
    seed: dir => {
      const api = join(dir, 'api')
      file(join(api, 'requirements.txt'), 'Django>=4.2\nrequests==2.31.0\n')
      file(join(api, 'requirements-dev.txt'), 'pytest\n')
      file(join(api, '.venv', 'pyvenv.cfg'), 'home = C:\\Python312\n')
      mkdirSync(join(api, '.venv', 'Lib', 'site-packages', 'Django-4.2.11.dist-info'), { recursive: true })
      mkdirSync(join(api, '.venv', 'Lib', 'site-packages', 'requests-2.31.0.dist-info'), { recursive: true })
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'py', name: 'api', path: api, framework: 'unknown', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
      writeFileSync(join(dir, 'packages.json'), JSON.stringify({ latest: { Django: '5.1.2', requests: '2.32.3', pytest: '8.3.3' } }))
    }
  })
  const { page } = run
  await goTo(page, '/project/py')
  await page.getByRole('tab', { name: 'Paquets' }).click()
  await page.getByRole('radio', { name: 'Tous' }).click()

  await expect(page.getByText('requirements.txt', { exact: true })).toBeVisible()
  await expect(page.getByText('requirements-dev.txt', { exact: true })).toBeVisible()
  const django = page.getByRole('row', { name: /Django/ })
  await expect(django).toContainText('4.2.11')
  await expect(django).toContainText('5.1.2')
  await expect(django).toContainText('majeure')
  await expect(page.getByRole('row', { name: /pytest/ })).toContainText('dev')

  // Read only: no audit nor update, the command instead
  await expect(page.getByRole('button', { name: /Mettre à jour/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Audit/ })).toHaveCount(0)
  await expect(page.getByText('pip install -U -r requirements.txt').first()).toBeVisible()
  expect(await settledAxe(page)).toEqual([])
})

test('code shows in colours, and the IDE button opens the file', async () => {
  test.skip(process.platform !== 'win32', 'an IDE added by hand, as a .cmd')
  let opened = ''
  run = await launch({
    seed: dir => {
      // An "IDE" added by hand that writes down what it was asked to open
      const ide = join(dir, 'fake-ide.cmd')
      opened = join(dir, 'opened.txt')
      writeFileSync(ide, '@echo off\r\n>"%~dp0opened.txt" echo %~1\r\n')
      const web = join(dir, 'web')
      file(join(web, 'package.json'), '{}')
      file(join(web, 'src', 'ComingSoon.vue'), '<script setup>\ndefineProps({ title: String })\n</script>\n\n<template>\n  <h2 class="title">{{ title }}</h2>\n</template>\n')
      file(join(web, 'LICENSE'), 'MIT <b>License</b>\n')
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([{ id: 'w', name: 'web', path: web, framework: 'vue', packageManager: 'npm', favorite: false, createdAt: '', lastOpenedAt: null }]))
      writeFileSync(join(dir, 'settings.json'), JSON.stringify({
        language: 'fr', onboarded: true, launcherEnabled: false, defaultIDE: 'fake',
        customIdes: [{ id: 'fake', name: 'FakeIDE', path: ide, args: '{dir}' }]
      }))
    }
  })
  const { page } = run
  await goTo(page, '/project/w?tab=files')
  await page.getByRole('button', { name: 'src' }).click()
  await page.getByRole('button', { name: 'ComingSoon.vue' }).click()
  const preview = page.getByTestId('file-preview')
  await expect(preview.locator('pre[data-language="xml"] .hljs-name').first()).toHaveText('script')
  await expect(preview.locator('.hljs-attr', { hasText: 'class' })).toHaveCount(1)
  // The colours are readable: the tag name differs from plain text
  const [tag, plain] = await Promise.all([
    preview.locator('.hljs-name').first().evaluate(e => getComputedStyle(e).color),
    preview.locator('pre').evaluate(e => getComputedStyle(e).color)
  ])
  expect(tag).not.toBe(plain)
  expect(await settledAxe(page)).toEqual([])

  // A file without a known language: plain text, its markup kept as text
  await page.getByRole('button', { name: 'LICENSE' }).click()
  await expect(preview.locator('pre')).toHaveText('MIT <b>License</b>\n')
  await expect(preview.locator('pre b')).toHaveCount(0)

  // The IDE button hands it the file, not the folder
  await page.getByRole('button', { name: 'ComingSoon.vue' }).click()
  await page.getByRole('button', { name: 'Ouvrir dans FakeIDE' }).click()
  await expect.poll(() => existsSync(opened), { timeout: 10_000 }).toBe(true)
  expect(readFileSync(opened, 'utf-8').trim()).toMatch(/[\\/]web[\\/]src[\\/]ComingSoon\.vue$/)
})
