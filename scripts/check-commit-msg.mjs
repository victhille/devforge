#!/usr/bin/env node
// The commit message format of the repository (CONTRIBUTING.md › Conventions), checked before the
// commit is made (lefthook › commit-msg):
//   type(zone): title            one line, Conventional Commits, 100 characters at most
//                                a blank line, then the details if any
//   node scripts/check-commit-msg.mjs <file with the message>
import { readFileSync } from 'fs'

const TYPES = ['feat', 'fix', 'security', 'perf', 'refactor', 'build', 'docs', 'test', 'ci', 'chore', 'style', 'revert']
const file = process.argv[2]
if (!file) { console.error('Usage: node scripts/check-commit-msg.mjs <message file>'); process.exit(2) }

// Git's own comments (# …) are not part of the message
const lines = readFileSync(file, 'utf-8').replace(/\r/g, '').split('\n').filter(l => !l.startsWith('#'))
const [title = '', second = ''] = lines
const fail = why => {
  console.error(`Commit message refused: ${why}\n  « ${title} »\nFormat: type(zone): title, then a blank line before the details. Types: ${TYPES.join(', ')}.`)
  process.exit(1)
}

// Merges and reverts written by git or GitHub keep their own form, and so do the fixups a rebase folds in
if (/^(Merge|Revert) |^(fixup|squash|amend)! /.test(title)) process.exit(0)
const m = /^(\w+)(\([\w./ -]+\))?!?: \S/.exec(title)
if (!m) fail('the first line must read type(zone): title')
if (!TYPES.includes(m[1])) fail(`unknown type "${m[1]}"`)
if (title.length > 100) fail(`the title is ${title.length} characters long (100 at most)`)
if (second.trim() !== '') fail('the title must be followed by a blank line')
