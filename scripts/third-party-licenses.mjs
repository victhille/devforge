#!/usr/bin/env node
// THIRD_PARTY_LICENSES.md: the open source packages shipped inside DevForge, with their license.
//   node scripts/third-party-licenses.mjs        (rewrites the file)
//   node scripts/third-party-licenses.mjs --check (fails when the file is out of date)
// Source: package-lock.json. Shipped = the main process packages (not "dev" in the lock,
// with their dependencies) + the packages the renderer bundles (listed below).
import { readFileSync, writeFileSync } from 'fs'

const lock = JSON.parse(readFileSync('package-lock.json', 'utf-8'))
const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))

// Bundled into the renderer by Vite (devDependencies in package.json, but shipped in the app)
const RENDERER = [
  '@fontsource-variable/geist', '@fontsource-variable/geist-mono', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/xterm',
  'clsx', 'highlight.js', 'lucide-react', 'pdfjs-dist', 'react', 'react-dom', 'react-router-dom', 'tailwind-merge'
]
// Packages whose lock entry has no "license" field (checked in their own package.json)
const KNOWN = { buildcheck: 'MIT', 'cpu-features': 'MIT', ssh2: 'MIT' }

const nameOf = path => path.replace(/^.*node_modules\//, '')
const entries = new Map()
for (const [path, info] of Object.entries(lock.packages)) {
  if (!path) continue
  const name = nameOf(path)
  const shipped = !info.dev || RENDERER.includes(name)
  if (!shipped || entries.has(`${name}@${info.version}`)) continue
  entries.set(`${name}@${info.version}`, { name, version: info.version, license: info.license ?? KNOWN[name] ?? 'Voir le paquet' })
}
// Transitive dependencies of the renderer packages
const deps = new Set(RENDERER)
for (const name of deps) {
  const info = lock.packages[`node_modules/${name}`]
  for (const dep of Object.keys(info?.dependencies ?? {})) deps.add(dep)
  if (info && !entries.has(`${name}@${info.version}`)) {
    entries.set(`${name}@${info.version}`, { name, version: info.version, license: info.license ?? KNOWN[name] ?? 'Voir le paquet' })
  }
}

const rows = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name))
const byLicense = rows.reduce((acc, r) => ({ ...acc, [r.license]: (acc[r.license] ?? 0) + 1 }), /** @type {Record<string, number>} */ ({}))
const summary = Object.entries(byLicense).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} (${n})`).join(', ')

const out = `# Licences tierces

DevForge ${pkg.version} est distribué sous [GPL-3.0](LICENSE). Il inclut les ${rows.length} paquets open source ci-dessous, chacun sous sa propre licence : le texte complet de chaque licence est dans le dossier du paquet (\`node_modules/<paquet>/LICENSE\`) et sur sa page npm.

Généré par \`npm run licenses\` à partir de \`package-lock.json\` : ne pas modifier à la main.

**Résumé** : ${summary}.

Points d'attention :
- **Polices Geist et Geist Mono** : SIL Open Font License 1.1 (OFL-1.1), redistribuables avec l'application, à ne pas vendre seules.
- **Apache-2.0** : les fichiers \`NOTICE\` éventuels de ces paquets sont conservés dans leur dossier.
- **LGPL-3.0** (bibliothèque d'images libvips, via sharp) : compatible avec la GPL-3.0 de DevForge.

| Paquet | Version | Licence |
|---|---|---|
${rows.map(r => `| ${r.name} | ${r.version} | ${r.license} |`).join('\n')}
`

if (process.argv.includes('--check')) {
  const current = readFileSync('THIRD_PARTY_LICENSES.md', 'utf-8').replace(/\r/g, '')
  if (current !== out) {
    console.error('THIRD_PARTY_LICENSES.md is out of date: run npm run licenses')
    process.exit(1)
  }
  console.log('THIRD_PARTY_LICENSES.md is up to date')
} else {
  writeFileSync('THIRD_PARTY_LICENSES.md', out)
  console.log(`THIRD_PARTY_LICENSES.md: ${rows.length} packages — ${summary}`)
}
