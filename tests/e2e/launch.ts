import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const ROOT = resolve(__dirname, '../..')

export interface Launched {
  app: ElectronApplication
  page: Page
  userData: string
  /** Uncaught errors of the page during the test */
  errors: string[]
  close: () => Promise<void>
}

/**
 * Starts the built app on a fresh profile (French UI unless `settings` says
 * otherwise); `seed` writes extra data files before the start.
 */
export async function launch(opts: { settings?: Record<string, unknown>; seed?: (userData: string) => void; env?: Record<string, string> } = {}): Promise<Launched> {
  const userData = mkdtempSync(join(tmpdir(), 'devforge-e2e-'))
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: 'fr', defaultProjectsDir: userData, launcherEnabled: false, ...opts.settings }))
  opts.seed?.(userData)
  // "{userData}" in a value stands for the profile folder
  const env = { DEVFORGE_TEST_OFFSCREEN: '1', ...Object.fromEntries(Object.entries(opts.env ?? {}).map(([k, v]) => [k, v.replace('{userData}', userData)])) }

  // The CI runner has no real GPU: its GPU process fails when several apps start at once
  const start = () => electron.launch({ args: ['.', `--user-data-dir=${userData}`, ...(process.env.CI ? ['--disable-gpu'] : [])], cwd: ROOT, env: { ...process.env as Record<string, string>, ...env } })
  // The very first start on a fresh runner can fail (antivirus scanning electron.exe): one more try
  const app = await start().catch(() => start())
  // The main window: the launcher and the desktop widget are windows too
  const isMain = (p: Page) => /index\.html/.test(p.url())
  let page = app.windows().find(isMain)
  while (!page) {
    await Promise.race([app.waitForEvent('window'), new Promise(r => setTimeout(r, 200))])
    page = app.windows().find(isMain)
  }
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.waitForSelector('main')

  return {
    app, page, userData, errors,
    close: async () => {
      await app.close().catch(() => {})
      rmSync(userData, { recursive: true, force: true, maxRetries: 3 })
    }
  }
}

/** Client-side navigation (HashRouter) */
export async function goTo(page: Page, route: string): Promise<void> {
  await page.evaluate(r => { location.hash = `#${r}` }, route)
}

/** v3.8.1: a project's tab, on the bar or in its "More" menu when the window is narrow */
export async function openProjectTab(page: Page, name: string): Promise<void> {
  // The name, then its count if it has one ("Déploiement 1")
  const label = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( \\d+)?$`)
  const tab = page.getByRole('tab', { name: label })
  const more = page.getByRole('button', { name: /^Plus/ })
  await tab.or(more).first().waitFor()
  if (await tab.count()) { await tab.click(); return }
  await more.click()
  await page.getByRole('menuitem', { name: label }).click()
}
