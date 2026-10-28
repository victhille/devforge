import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

/**
 * v3.7: a stand-in "vitest" for a seeded project: it prints a few lines and
 * writes a report in Vitest's JSON format where it is told. The discount test
 * fails until a file named "fixed" is in the project; file arguments run only
 * those files.
 */
const FAKE_VITEST = `
const fs = require('fs'), path = require('path')
const out = process.argv.find(a => a.startsWith('--outputFile.json='))?.split('=')[1]
const root = process.cwd()
const only = process.argv.slice(2).filter(a => !a.startsWith('-') && a !== 'run')
const fixed = fs.existsSync('fixed')
console.log(' RUN  v3.2.7 ' + root)
console.log(' ✓ src/format.test.ts (2 tests)')
console.log(fixed ? ' ✓ src/cart.test.ts (3 tests)' : ' ❯ src/cart.test.ts (3 tests | 1 failed)')
const discount = fixed
  ? { ancestorTitles: ['cart'], title: 'applies the discount', status: 'passed', duration: 5, failureMessages: [] }
  : { ancestorTitles: ['cart'], title: 'applies the discount', status: 'failed', duration: 7, failureMessages: ['AssertionError: expected 90 to be 85 // Object.is equality\\n    at ' + path.join(root, 'src', 'cart.test.ts') + ':6:15'] }
const files = [
  { name: path.join(root, 'src', 'cart.test.ts'), assertionResults: [
    { ancestorTitles: ['cart'], title: 'adds the items', status: 'passed', duration: 4, failureMessages: [] },
    discount,
    { ancestorTitles: ['cart'], title: 'later', status: 'skipped', duration: 0, failureMessages: [] }
  ] },
  { name: path.join(root, 'src', 'format.test.ts'), assertionResults: [
    { ancestorTitles: [], title: 'formats a price', status: 'passed', duration: 2, failureMessages: [] },
    { ancestorTitles: [], title: 'formats a date', status: 'passed', duration: 1, failureMessages: [] }
  ] }
].filter(f => !only.length || only.some(o => f.name.split(path.sep).join('/').endsWith(o)))
fs.writeFileSync(out, JSON.stringify({ testResults: files }))
process.exit(files.some(f => f.assertionResults.some(a => a.status === 'failed')) ? 1 : 0)
`

const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }

export function seedVitestProject(dir: string): void {
  file(join(dir, 'package.json'), JSON.stringify({ name: 'shop', devDependencies: { vitest: '^3.2.0' } }))
  file(join(dir, 'src', 'cart.test.ts'), "import { expect, it } from 'vitest'\n\nit('adds the items', () => {})\n\nit('applies the discount', () => {\n  expect(90).toBe(85)\n})\n")
  file(join(dir, 'node_modules', '.bin', 'fake-vitest.js'), FAKE_VITEST)
  file(join(dir, 'node_modules', '.bin', 'vitest.cmd'), '@node "%~dp0fake-vitest.js" %*\r\n')
  file(join(dir, 'node_modules', '.bin', 'vitest'), '#!/bin/sh\nnode "$(dirname "$0")/fake-vitest.js" "$@"\n')
}
