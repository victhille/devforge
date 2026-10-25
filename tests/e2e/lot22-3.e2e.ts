import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { launch, type Launched } from './launch'
import { settledAxeIssues } from './axe'

/** v2.2 lot 3: the global launcher (an odd shortcut, so the tests never take the user's Ctrl+Alt+Space) */
let run: Launched
test.afterEach(async () => {
  expect(run.errors, 'uncaught page errors').toEqual([])
  await run.close()
})

const SHORTCUT = 'CommandOrControl+Alt+Shift+F9'

async function start(): Promise<Page> {
  run = await launch({
    settings: { launcherEnabled: true, launcherShortcut: SHORTCUT },
    seed: dir => {
      const project = join(dir, 'boutique')
      mkdirSync(project, { recursive: true })
      writeFileSync(join(project, 'package.json'), JSON.stringify({ name: 'boutique', scripts: { dev: 'vite' } }))
      writeFileSync(join(dir, 'projects.json'), JSON.stringify([
        { id: 'p1', name: 'boutique', path: project, framework: 'react', packageManager: 'npm', favorite: false, createdAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: null }
      ]))
    }
  })
  // The launcher window is created hidden at startup, ready to show
  let page: Page | undefined
  await expect.poll(() => { page = run.app.windows().find(w => w.url().includes('launcher.html')); return !!page }).toBe(true)
  return page!
}

/** What the shortcut does: show the window, tell the page */
async function open(): Promise<number> {
  return run.app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('launcher.html'))!
    const t0 = Date.now()
    w.webContents.send('launcher:shown')
    // Like showLauncher(), without taking the focus from the user (tests run off-screen)
    w.setPosition(-32000, -32000)
    w.showInactive()
    return Date.now() - t0
  })
}

const visible = () => run.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(x => x.webContents.getURL().includes('launcher.html'))!.isVisible())

test('shortcut taken, instant opening, search, calculation, a page opened in DevForge', async () => {
  const page = await start()
  expect(await run.app.evaluate(({ globalShortcut }, k) => globalShortcut.isRegistered(k), SHORTCUT)).toBe(true)
  expect(await open()).toBeLessThan(200)
  const input = page.getByRole('combobox')
  await expect(input).toBeFocused()

  await input.fill('vs bout')
  await expect(page.getByRole('option').first()).toContainText('Ouvrir dans VS Code — boutique')
  expect(await settledAxeIssues(page)).toEqual([])

  await input.fill('12 × 4,5')
  await expect(page.getByRole('option').first()).toContainText('54')
  await input.fill('#5B9BFF')
  await expect(page.getByRole('option').first()).toContainText('rgb(91, 155, 255)')

  await input.fill('docker')
  await expect(page.getByRole('option').first()).toContainText('Docker')
  await input.press('Enter')
  await expect.poll(visible).toBe(false)
  await expect.poll(() => run.page.evaluate(() => location.hash)).toBe('#/docker')

  // Used once: first of the "recently used" list on the next opening
  await open()
  await expect(page.getByText('Utilisés récemment')).toBeVisible()
  await expect(page.getByRole('option').first()).toContainText('Docker')
  await input.press('Escape')
  await expect.poll(visible).toBe(false)
})

test('a question for Forgy goes to the main window; the shortcut is set in the settings', async () => {
  const page = await start()
  await open()
  const input = page.getByRole('combobox')
  await input.fill('pourquoi mon build casse')
  await input.press('Tab')
  await expect(page.getByRole('option', { selected: true })).toContainText('Demander à Forgy « pourquoi mon build casse »')
  await input.press('Enter')
  await expect.poll(visible).toBe(false)
  await expect(run.page.getByText('pourquoi mon build casse')).toBeVisible()

  await run.page.evaluate(() => { location.hash = '#/settings?section=general' })
  await expect(run.page.getByRole('heading', { name: 'Lanceur global' })).toBeVisible()
  await expect(run.page.getByText('Ctrl + Alt + Shift + F9')).toBeVisible()
  await run.page.getByRole('button', { name: 'Changer' }).click()
  await run.page.keyboard.press('Control+Alt+Shift+F8')
  await expect(run.page.getByText('Ctrl + Alt + Shift + F8')).toBeVisible()
  await expect.poll(() => run.app.evaluate(({ globalShortcut }) => globalShortcut.isRegistered('CommandOrControl+Alt+Shift+F8'))).toBe(true)
  expect(await run.app.evaluate(({ globalShortcut }, k) => globalShortcut.isRegistered(k), SHORTCUT)).toBe(false)
  expect(await settledAxeIssues(run.page)).toEqual([])
})
