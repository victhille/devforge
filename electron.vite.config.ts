import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'
import { publishConfig } from './scripts/publish-config.mjs'

/** Where releases and the repository are (package.json): the updater and the "About" links */
const PUBLISH = publishConfig(__dirname)

/**
 * Content-Security-Policy for the packaged renderer. Production only: the dev
 * server needs inline scripts and websockets for hot reload. Network access
 * goes through the main process, so the page itself talks to nobody.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  // API tester HTML preview: sandboxed data: frame, scripts off
  "frame-src data:"
].join('; ')

function gitCommit(): string {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' }).trim() } catch { return 'dev' }
}

/** Release notes per UI language: CHANGELOG.md is French, CHANGELOG.<lang>.md the others */
function changelogs(): Record<'fr' | 'en', string> {
  const read = (file: string) => { const p = resolve(__dirname, file); return existsSync(p) ? readFileSync(p, 'utf-8') : '' }
  return { fr: read('CHANGELOG.md'), en: read('CHANGELOG.en.md') }
}

function csp(): Plugin {
  return {
    name: 'devforge-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }
    ]
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __PUBLISH__: JSON.stringify(PUBLISH) },
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          // Forgy's always-on-top desktop bubble (src/main/widget.ts)
          widget: resolve(__dirname, 'src/renderer/widget.html'),
          // Global launcher, Ctrl+Alt+Space (src/main/launcher.ts)
          launcher: resolve(__dirname, 'src/renderer/launcher.html')
        }
      }
    },
    plugins: [react(), tailwindcss(), csp()],
    define: {
      __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8')).version),
      __APP_COMMIT__: JSON.stringify(gitCommit()),
      __REPO_URL__: JSON.stringify(PUBLISH.url),
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __CHANGELOGS__: JSON.stringify(changelogs())
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    }
  }
})
