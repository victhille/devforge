// Checks every internal link (and its #anchor) of the built site, so a renamed page or heading
// cannot leave a dead link behind (the app's F1 help links are checked by tests/renderer/docsLinks.test.ts).
//   node scripts/check-links.mjs dist
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2]
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p] })
const pages = walk(dist).filter(f => f.endsWith('.html'))
const ids = new Map()
const idsOf = file => {
  if (!ids.has(file)) ids.set(file, new Set([...readFileSync(file, 'utf-8').matchAll(/\sid="([^"]+)"/g)].map(m => m[1])))
  return ids.get(file)
}
let bad = 0
for (const page of pages) {
  const html = readFileSync(page, 'utf-8')
  for (const [, href] of html.matchAll(/href="(\/devforge\/[^"]*)"/g)) {
    const [path, hash] = href.replace('/devforge/', '').split('#')
    let target = join(dist, decodeURI(path))
    if (!/\.\w+$/.test(target)) target = join(target, 'index.html')
    if (!existsSync(target)) { console.log(`${page.slice(dist.length)} → ${href} (missing page)`); bad++; continue }
    if (hash && target.endsWith('.html') && !idsOf(target).has(decodeURIComponent(hash))) { console.log(`${page.slice(dist.length)} → ${href} (missing anchor)`); bad++ }
  }
}
console.log(bad ? `${bad} broken link(s)` : `All internal links OK in ${pages.length} pages`)
if (bad) process.exit(1)
