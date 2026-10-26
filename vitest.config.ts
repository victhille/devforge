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
    __REPO_URL__: JSON.stringify('https://github.com/example/devforge')
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 20_000,
    // Each file gets its own userData folder (see setup.ts)
    isolate: true
  }
})
