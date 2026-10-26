import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests on the built app (run `npm run build` first): each test
 * starts Electron with its own empty profile. See tests/e2e.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.e2e.ts',
  // GitHub's runner is slower, more so at the end of the suite
  timeout: process.env.CI ? 90_000 : 60_000,
  globalSetup: './tests/e2e/warmup.ts',
  expect: { timeout: 10_000 },
  // Several Electrons at once: each test has its own profile, and the
  // single-instance lock is per profile. On GitHub's runner, 3 at once made
  // some fail to start: 2 there.
  workers: process.env.CI ? 2 : 4,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list'
})
