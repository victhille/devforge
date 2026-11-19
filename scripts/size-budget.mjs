#!/usr/bin/env node
// Size budget: fails when what DevForge loads before its first screen, or its installer, grows past its limit.
//   node scripts/size-budget.mjs                  the JavaScript of the first screen (out/renderer, after npm run build)
//   node scripts/size-budget.mjs --installer FILE the installer too (the Release workflow)
// A limit that no longer fits is raised on purpose, in this file, with the reason in the commit.
import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const MB = 1024 * 1024
/** The entry and the modules it preloads: 1.2 MB measured in November 2026 */
const FIRST_SCREEN_JS = 1.6 * MB
/** The NSIS installer: 132 MB measured in November 2026 */
const INSTALLER = 150 * MB

const fmt = n => `${(n / MB).toFixed(2)} MB`
let failed = false
const check = (what, size, limit) => {
  const ok = size <= limit
  console.log(`${ok ? '✔' : '✘'} ${what}: ${fmt(size)} (limit ${fmt(limit)})`)
  if (!ok) failed = true
}

const html = 'out/renderer/index.html'
if (!existsSync(html)) { console.error(`${html} is missing: run npm run build first`); process.exit(2) }
const page = readFileSync(html, 'utf8')
// The entry script and every <link rel="modulepreload">: what the window reads before it shows anything
const files = new Set([...page.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.js)"/g)].map(m => m[1]))
// None found means the page changed shape (another base path): a total of 0 would pass without measuring anything
if (!files.size) { console.error(`No script found in ${html}: update the pattern in scripts/size-budget.mjs`); process.exit(2) }
const total = [...files].reduce((n, f) => n + statSync(join('out/renderer', f)).size, 0)
check(`first screen, ${files.size} JS files`, total, FIRST_SCREEN_JS)

const at = process.argv.indexOf('--installer')
if (at > 0) {
  const file = process.argv[at + 1]
  if (!file || !existsSync(file)) { console.error(`Installer not found: ${file}`); process.exit(2) }
  check(`installer ${file}`, statSync(file).size, INSTALLER)
}
process.exit(failed ? 1 : 0)
