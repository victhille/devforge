import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { goTo, launch, type Launched } from './launch'
import { axeIssues } from './axe'

/** Finishing touches: first launch, keyboard, WCAG checks in both themes */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

test('first launch: projects folder, scan, optional key, then never again', async () => {
  run = await launch({
    seed: dir => {
      const code = join(dir, 'code')
      mkdirSync(join(code, 'shop'), { recursive: true })
      mkdirSync(join(code, 'notes'))
      writeFileSync(join(code, 'shop', 'package.json'), JSON.stringify({ name: 'shop', dependencies: { react: '18.0.0' } }))
      writeFileSync(join(dir, 'settings.json'), JSON.stringify({ language: 'fr', defaultProjectsDir: code, onboarded: false }))
    }
  })
  const { page, userData } = run
  const dialog = page.getByRole('dialog', { name: 'Bienvenue dans DevForge' })
  await expect(dialog).toBeVisible()
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(page.getByText('1 projet(s) trouvé(s)')).toBeVisible()
  await page.getByRole('button', { name: 'Ajouter 1 projet(s)' }).click()
  await expect(page.getByText('1 projet(s) ajouté(s)')).toBeVisible()
  await page.getByRole('button', { name: 'Plus tard' }).click()
  await page.getByRole('button', { name: "C'est parti" }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(JSON.parse(readFileSync(join(userData, 'projects.json'), 'utf-8')).map((p: { name: string }) => p.name)).toEqual(['shop'])
  await expect.poll(() => JSON.parse(readFileSync(join(userData, 'settings.json'), 'utf-8')).onboarded).toBe(true)
})

test('keyboard: the first Tab skips to the content', async () => {
  run = await launch()
  const { page } = run
  await page.keyboard.press('Tab')
  const skip = page.getByRole('button', { name: 'Aller au contenu' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#main')).toBeFocused()
})

for (const theme of ['dark', 'light']) {
  test(`no serious WCAG problem on the main pages (${theme})`, async () => {
    test.setTimeout(180_000)
    // Reduced motion: no element is caught half-faded by an entrance animation
    run = await launch({ settings: { theme, motion: 'reduced' } })
    const { page } = run
    const found: string[] = []
    for (const route of ['/', '/projects', '/docker', '/database', '/api-tester', '/monitor', '/n8n', '/settings', '/settings?section=data', '/settings?notes=all', '/ssh', '/toolbox', '/webhooks']) {
      await goTo(page, route)
      await page.waitForTimeout(800)
      for (const v of await axeIssues(page)) if (v.impact === 'serious' || v.impact === 'critical') found.push(`${route} ${v.id}: ${v.nodes.slice(0, 2).join(' || ')}`)
    }
    expect(found).toEqual([])
  })
}
