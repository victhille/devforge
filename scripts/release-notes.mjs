#!/usr/bin/env node
// Print the CHANGELOG.md section of one version (used as GitHub release notes).
//   node scripts/release-notes.mjs v1.2.0
import { readFileSync } from 'fs'
import { extractSection } from './lib/release.mjs'

const version = (process.argv[2] ?? '').replace(/^v/, '')
const section = extractSection(readFileSync('CHANGELOG.md', 'utf-8'), version)
if (!section) {
  console.error(`No section for ${version} in CHANGELOG.md`)
  process.exit(1)
}
// The release page already shows the version as its title
process.stdout.write(section.split('\n').slice(1).join('\n').trim() + '\n')
