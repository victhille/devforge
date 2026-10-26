#!/usr/bin/env node
// Fails when a personal word (an IP, a name, a private project…) comes back in
// a tracked file. The words are not in the repository: they come from the
// PERSONAL_PATTERNS environment variable (a GitHub secret in CI) or from
// .personal-patterns (git-ignored), one per line, case-insensitive.
//
//   node scripts/check-personal.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const raw = process.env.PERSONAL_PATTERNS ?? (existsSync('.personal-patterns') ? readFileSync('.personal-patterns', 'utf-8') : '')
const words = raw.split(/\r?\n|,/).map(w => w.trim()).filter(w => w && !w.startsWith('#'))
if (!words.length) {
  console.log('No personal words to look for (PERSONAL_PATTERNS or .personal-patterns): skipped.')
  process.exit(0)
}

const files = execFileSync('git', ['ls-files'], { encoding: 'utf-8' }).split('\n').filter(Boolean)
const lower = words.map(w => w.toLowerCase())
const hits = []
for (const file of files) {
  let text
  try { text = readFileSync(file, 'utf-8') } catch { continue }
  if (text.includes('\u0000')) continue
  text.split('\n').forEach((line, i) => {
    const l = line.toLowerCase()
    // Only the line and which word number: the word itself is not printed in the CI log
    lower.forEach((w, k) => { if (l.includes(w)) hits.push(`${file}:${i + 1} (word #${k + 1})`) })
  })
}
if (hits.length) {
  console.error(`✖ ${hits.length} personal word(s) found:\n${hits.join('\n')}`)
  process.exit(1)
}
console.log(`✔ No personal word in ${files.length} files.`)
