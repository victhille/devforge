#!/usr/bin/env node
// Cut a release: next version from the commits, CHANGELOG.md, commit + tag.
//
//   npm run release                 version computed from the commits (feat → minor, fix → patch, ! → major)
//   npm run release -- minor        force the bump (major | minor | patch | 1.4.0)
//   npm run release -- --pre beta   prerelease: 1.3.0-beta.1, then -beta.2… ; a plain release finalizes it
//   npm run release -- --dry-run    show the version and notes, change nothing
//   --summary-fr "…" --summary-en "…"  one-line summary of the version (release notes card)
//   --build  also build the installer locally (dist/)
//   --push   push the commit and tag: GitHub Actions builds and publishes the release
//   --no-check  skip `npm run check` (typecheck, lint, tests, build)

import { execFileSync, spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { LANGS, bumpFor, changelogFile, extractSection, nextVersion, parseCommit, prependSection, renderSection } from './lib/release.mjs'

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const positional = args.filter((a, i) => !a.startsWith('--') && !['--pre', '--summary-fr', '--summary-en'].includes(args[i - 1]))[0] ?? 'auto'

const git = (...a) => execFileSync('git', a, { encoding: 'utf-8' }).trim()
const npm = (...a) => {
  // npm is a .cmd on Windows: needs a shell (arguments here are fixed, not user input)
  const r = spawnSync('npm', a, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) fail(`npm ${a.join(' ')} failed`)
}
function fail(msg) { console.error(`\n✖ ${msg}`); process.exit(1) }

// ─── Preconditions ────────────────────────────────────────────────────────────

const dryRun = flag('--dry-run')
if (!dryRun && git('status', '--porcelain')) fail('Working tree is not clean: commit or stash first.')
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
if (!dryRun && !['main', 'master'].includes(branch)) fail(`Release from main, not "${branch}".`)

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
let lastTag = null
try { lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*') } catch { /* first release */ }

// ─── Changes since the last tag ───────────────────────────────────────────────

const SEP = '\x1f', END = '\x1e'
const log = git('log', `--format=%H${SEP}%s${SEP}%b${END}`, ...(lastTag ? [`${lastTag}..HEAD`] : []))
const changes = log.split(END).map(e => e.trim()).filter(Boolean)
  .map(e => { const [hash, subject, body] = e.split(SEP); return parseCommit(hash, subject, body) })
  .filter(Boolean)
if (!changes.length && positional === 'auto') fail(`No change since ${lastTag ?? 'the beginning'}.`)

const pre = option('--pre')
const bump = positional === 'auto' ? bumpFor(changes) : positional
const version = nextVersion(pkg.version, bump, pre)

let repoUrl = null
try {
  repoUrl = git('remote', 'get-url', 'origin').replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '')
} catch { /* no remote */ }

const previous = lastTag?.replace(/^v/, '') ?? null
const sections = Object.fromEntries(LANGS.map(lang => [lang, renderSection(version, changes, { lang, repoUrl, previous, summary: option(`--summary-${lang}`) })]))

console.log(`\n${pkg.version} → ${version}  (${positional === 'auto' ? `${bump}, from ${changes.length} commit(s)` : bump}${pre ? `, ${pre}` : ''})\n`)
console.log(sections.fr)
console.log(sections.en)
if (dryRun) process.exit(0)

// ─── Release ──────────────────────────────────────────────────────────────────

if (!flag('--no-check')) npm('run', 'check')

npm('version', version, '--no-git-tag-version', '--allow-same-version')
for (const lang of LANGS) {
  const file = changelogFile(lang)
  writeFileSync(file, prependSection(existsSync(file) ? readFileSync(file, 'utf-8') : '', sections[lang], lang))
}

git('add', 'package.json', 'package-lock.json', ...LANGS.map(changelogFile))
git('commit', '-m', `chore(release): v${version}`)
git('tag', '-a', `v${version}`, '-m', extractSection(readFileSync('CHANGELOG.md', 'utf-8'), version) ?? `v${version}`)
console.log(`\n✔ Tagged v${version}`)

if (flag('--build')) npm('run', 'dist')
if (flag('--push')) {
  git('push', '--follow-tags')
  console.log(`✔ Pushed: GitHub Actions builds the installer and publishes the release${repoUrl ? ` (${repoUrl}/releases)` : ''}`)
} else {
  console.log('Publish with: git push --follow-tags')
}
