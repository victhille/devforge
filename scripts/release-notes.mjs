#!/usr/bin/env node
// GitHub release notes of one version: French, then English in a fold.
//   node scripts/release-notes.mjs v1.2.0
import { existsSync, readFileSync } from 'fs'
import { changelogFile, extractSection } from './lib/release.mjs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
// The release page already shows the version as its title: drop the "## x.y.z" line
const notes = lang => {
  const file = changelogFile(lang)
  const section = existsSync(file) ? extractSection(readFileSync(file, 'utf-8'), version) : null
  return section?.split('\n').slice(1).join('\n').trim() ?? null
}

const fr = notes('fr')
if (!fr) {
  console.error(`No section for ${version} in CHANGELOG.md`)
  process.exit(1)
}
const en = notes('en')
process.stdout.write(en ? `${fr}\n\n<details><summary>English</summary>\n\n${en}\n\n</details>\n` : `${fr}\n`)
