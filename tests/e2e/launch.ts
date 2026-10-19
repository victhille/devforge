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
  writeFileSync(join(userData, 'settings.json'), JSON.stringify({ language: 'fr', defaultProjectsDir: userData, ...opts.settings }))
  opts.seed?.(userData)
  // "{userData}" in a value stands for the profile folder
  const env = Object.fromEntries(Object.entries(opts.env ?? {}).map(([k, v]) => [k, v.replace('{userData}', userData)]))

  const app = await electron.launch({ args: ['.', `--user-data-dir=${userData}`], cwd: ROOT, env: { ...process.env as Record<string, string>, ...env } })
  const page = await app.firstWindow()
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
