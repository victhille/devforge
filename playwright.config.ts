import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests on the built app (run `npm run build` first): each test
 * starts Electron with its own empty profile. See tests/e2e.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Several Electrons at once: each test has its own profile, and the
  // single-instance lock is per profile. GitHub's Windows runners have 4 cores.
  workers: process.env.CI ? 3 : 4,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list'
})
