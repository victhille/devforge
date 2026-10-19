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
  // One Electron at a time: the app holds a single-instance lock per profile
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list'
})
