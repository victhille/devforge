#!/usr/bin/env node
// The open source packages shipped inside DevForge (Windows x64 installer), with their license.
//   node scripts/third-party-licenses.mjs           rewrites THIRD_PARTY_LICENSES.md (the list, in the repository)
//   node scripts/third-party-licenses.mjs --check   fails when THIRD_PARTY_LICENSES.md is out of date (CI)
//   node scripts/third-party-licenses.mjs --notices writes out/licenses/THIRD_PARTY_NOTICES.txt: every
//                                                   license text, shipped in the installer (npm run build)
// Source: package-lock.json. Shipped = the main process packages (not "dev" in the lock, with their
// dependencies) + the packages the renderer bundles (listed below), minus what electron-builder leaves
// out (other platforms, build.files exclusions).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const lock = JSON.parse(readFileSync('package-lock.json', 'utf-8'))
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))

// Bundled into the renderer by Vite (devDependencies in package.json, but shipped in the app)
const RENDERER = [
  '@xterm/addon-fit',
  '@xterm/addon-web-links',
  '@xterm/xterm',
  'clsx',
  'highlight.js',
  'lucide-react',
  'pdfjs-dist',
  'react',
  'react-dom',
  'react-router-dom',
  'tailwind-merge',
  'uqr'
]
// Bundled into the main process by Vite (devDependencies too): the MCP client. Its server side
// (express, hono…) is never imported, so it is not shipped
const MAIN = ['@modelcontextprotocol/sdk']
const MAIN_NOT_BUNDLED = new Set(['express', 'hono', '@hono/node-server', 'cors', 'raw-body', 'express-rate-limit', 'content-type', 'jose'])
// Left out of the installer by package.json › build.files
const NOT_SHIPPED = ['onnxruntime-web', '@img/sharp-wasm32']
// Packages whose lock entry has no "license" field (checked in their own package.json)
const KNOWN = { buildcheck: 'MIT', 'cpu-features': 'MIT', ssh2: 'MIT' }
// The installer is Windows x64 only
const forThisTarget = info =>
  (!info.os || info.os.some(o => o === 'win32') || info.os.every(o => o.startsWith('!') && o !== '!win32')) &&
  (!info.cpu || info.cpu.some(c => c === 'x64') || info.cpu.every(c => c.startsWith('!') && c !== '!x64'))

const nameOf = path => path.replace(/^.*node_modules\//, '')
const entries = new Map()
const add = (path, info) => {
  const name = nameOf(path)
  const key = `${name}@${info.version}`
  if (entries.has(key) || NOT_SHIPPED.includes(name) || !forThisTarget(info)) return
  // An optional package npm could not install (a native build that failed) is not shipped either
  if (info.optional && !existsSync(path)) return
  entries.set(key, { name, version: info.version, path, license: info.license ?? KNOWN[name] ?? 'Voir le paquet' })
}
for (const [path, info] of Object.entries(lock.packages)) {
  if (path && (!info.dev || RENDERER.includes(nameOf(path)))) add(path, info)
}
// Transitive dependencies of the renderer packages, and of the main process's bundled ones
// Resolved like Node: a copy nested under the package that needs it wins over the top-level one
const resolveDep = (from, dep) => {
  for (let base = from; base; base = base.includes('/node_modules/') ? base.slice(0, base.lastIndexOf('/node_modules/')) : '') {
    if (lock.packages[`${base}/node_modules/${dep}`]) return `${base}/node_modules/${dep}`
  }
  return lock.packages[`node_modules/${dep}`] ? `node_modules/${dep}` : null
}
const paths = new Set([...RENDERER, ...MAIN].map(name => `node_modules/${name}`))
for (const path of paths) {
  const info = lock.packages[path]
  if (!info) continue
  for (const dep of Object.keys(info.dependencies ?? {})) {
    const p = MAIN_NOT_BUNDLED.has(dep) ? null : resolveDep(path, dep)
    if (p) paths.add(p)
  }
  add(path, info)
}

const rows = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
const byLicense = rows.reduce((acc, r) => ({ ...acc, [r.license]: (acc[r.license] ?? 0) + 1 }), /** @type {Record<string, number>} */ ({}))
const summary = Object.entries(byLicense)
  .sort((a, b) => b[1] - a[1])
  .map(([l, n]) => `${l} (${n})`)
  .join(', ')

// ─── The license text of each package ─────────────────────────────────────────

const MIT = holder => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`

const ISC = holder => `ISC License

Copyright (c) ${holder}

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.`

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([-._].*)?$/i
const holderOf = row => {
  try {
    const author = JSON.parse(readFileSync(join(row.path, 'package.json'), 'utf-8')).author
    const name = typeof author === 'string' ? author.replace(/\s*[<(].*$/, '') : author?.name
    if (name) return name
  } catch {
    /* no package.json: generic holder below */
  }
  return `the ${row.name} authors`
}
const textOf = row => {
  const files = existsSync(row.path)
    ? readdirSync(row.path)
        .filter(f => LICENSE_FILE.test(f))
        .sort()
    : []
  if (files.length) return files.map(f => readFileSync(join(row.path, f), 'utf-8').replace(/\r/g, '').trim()).join('\n\n')
  // The package ships no license file: its declared license, with its author as the holder
  if (row.license === 'MIT') return MIT(holderOf(row))
  if (row.license === 'ISC') return ISC(holderOf(row))
  return `${row.license} : https://spdx.org/licenses/${encodeURIComponent(row.license)}.html`
}

// libvips (inside @img/sharp-win32-x64): its README lists the libraries built into the DLL, under LGPL-3.0
const LIBVIPS = '@img/sharp-win32-x64'
const libvipsNote = row => {
  const readme = join(row.path, 'README.md')
  return existsSync(readme) ? readFileSync(readme, 'utf-8').replace(/\r/g, '').trim() : ''
}

// ─── Outputs ──────────────────────────────────────────────────────────────────

const list = `# Licences tierces

DevForge ${pkg.version} est distribué sous [GPL-3.0-only](LICENSE). Il inclut les ${rows.length} paquets open source ci-dessous, chacun sous sa propre licence. Le texte complet de chaque licence est livré avec l'application, dans \`THIRD_PARTY_NOTICES.txt\` (Paramètres › À propos › Licences tierces).

Généré par \`npm run licenses\` à partir de \`package-lock.json\` (installeur Windows x64) : ne pas modifier à la main.

**Résumé** : ${summary}.

Points d'attention :
- **Polices Inter, JetBrains Mono et Bricolage Grotesque** : SIL Open Font License 1.1 (OFL-1.1), redistribuables avec l'application, à ne pas vendre seules.
- **Apache-2.0** : les fichiers \`NOTICE\` de ces paquets, s'il y en a, sont repris dans \`THIRD_PARTY_NOTICES.txt\`.
- **LGPL-3.0** (bibliothèque d'images libvips, via sharp) : compatible avec la GPL-3.0 de DevForge ; son texte et la liste des bibliothèques qu'elle contient sont dans \`THIRD_PARTY_NOTICES.txt\`.

| Paquet | Version | Licence |
|---|---|---|
${rows.map(r => `| ${r.name} | ${r.version} | ${r.license} |`).join('\n')}
`

if (process.argv.includes('--notices')) {
  const rule = '='.repeat(78)
  const parts = rows.map(r => {
    const extra = r.name === LIBVIPS ? `\n\n${libvipsNote(r)}` : ''
    return `${rule}\n${r.name} ${r.version} — ${r.license}\n${rule}\n\n${textOf(r)}${extra}\n`
  })
  const lgpl = readFileSync('build/licenses/LGPL-3.0.txt', 'utf-8').replace(/\r/g, '').trim()
  const out = `DevForge ${pkg.version} — notices des composants tiers · third-party notices

DevForge est distribué sous GPL-3.0-only (LICENSE.txt, à côté de ce fichier). Il inclut les ${rows.length} paquets
open source ci-dessous ; voici, pour chacun, sa licence et ses mentions de copyright. Electron et Chromium
livrent les leurs dans LICENSE.electron.txt et LICENSES.chromium.html, dans le dossier d'installation.

DevForge is distributed under GPL-3.0-only (LICENSE.txt, next to this file). It includes the ${rows.length} open source
packages below; here are, for each one, its license and copyright notices. Electron and Chromium ship
theirs in LICENSE.electron.txt and LICENSES.chromium.html, in the installation folder.

${parts.join('\n')}
${rule}
GNU Lesser General Public License, version 3 (libvips, inside ${LIBVIPS})
${rule}

${lgpl}
`
  mkdirSync('out/licenses', { recursive: true })
  writeFileSync('out/licenses/THIRD_PARTY_NOTICES.txt', out)
  const missing = rows.filter(r => !(existsSync(r.path) && readdirSync(r.path).some(f => LICENSE_FILE.test(f))))
  console.log(
    `out/licenses/THIRD_PARTY_NOTICES.txt: ${rows.length} packages, ${Math.round(out.length / 1024)} KB — texts written from the SPDX license for ${missing.length}: ${missing.map(r => r.name).join(', ') || 'none'}`
  )
} else if (process.argv.includes('--check')) {
  const current = readFileSync('THIRD_PARTY_LICENSES.md', 'utf-8').replace(/\r/g, '')
  if (current !== list) {
    console.error('THIRD_PARTY_LICENSES.md is out of date: run npm run licenses')
    process.exit(1)
  }
  console.log('THIRD_PARTY_LICENSES.md is up to date')
} else {
  writeFileSync('THIRD_PARTY_LICENSES.md', list)
  console.log(`THIRD_PARTY_LICENSES.md: ${rows.length} packages — ${summary}`)
}
