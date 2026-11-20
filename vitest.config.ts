import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      // Main-process code runs in plain Node: app paths and encryption are faked
      electron: resolve(__dirname, 'tests/stubs/electron.ts')
    }
  },
  define: {
    __PUBLISH__: JSON.stringify({ owner: 'example', repo: 'devforge', private: false, url: 'https://github.com/example/devforge' }),
    __REPO_URL__: JSON.stringify('https://github.com/example/devforge'),
    __DOCS_URL__: JSON.stringify('https://example.github.io/devforge/')
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    // Each file gets its own userData folder (see setup.ts)
    isolate: true,
    // Coverage of the main process and the shared code, measured in the CI (CI=true) or by `npm run test:coverage`.
    // The services hold the app's logic: their floor stops a change that drops tests without anyone noticing
    coverage: {
      enabled: process.env.CI === 'true',
      provider: 'v8',
      include: ['src/main/**/*.ts', 'src/shared/**/*.ts'],
      reporter: ['text-summary'],
      // Its working files hold absolute paths: under node_modules, ignored by git, even when a run is cut short
      reportsDirectory: 'node_modules/.cache/coverage',
      // Measured at 66 % of lines, 62 % of statements and functions, 52 % of branches (2026-11): a few points of margin,
      // to raise as tests are added
      thresholds: {
        'src/main/services/**': { lines: 60, statements: 56, functions: 56, branches: 47 }
      }
    }
  }
})
