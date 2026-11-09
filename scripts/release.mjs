#!/usr/bin/env node
// Cut a release through pull requests (main only takes PRs). See docs/dev/versions.md.
//
// 1. Prepare, on develop:  npm run release -- prepare --summary-fr "…" --summary-en "…"
//    Next version from the commits, `npm run check`, new branch release/X.Y.Z, then
//    package.json, package-lock.json, CHANGELOG.md, CHANGELOG.en.md, THIRD_PARTY_LICENSES.md.
//    Rewrite the two new sections for users, then run `npm run release -- prepare` again on
//    the branch: it commits `chore(release): vX.Y.Z` (no tag, no push).
//    Push the branch and open its PR to main, merged with a merge commit.
// 2. Tag, on main pulled after the merge:  npm run release -- tag X.Y.Z
//    Checks package.json, tags vX.Y.Z (message: its CHANGELOG section) and pushes that tag
//    alone: the Release workflow builds the installer and publishes the release.
//    Then a PR main → develop, merged with a merge commit too.
//
// prepare
//   patch | minor | major | 1.4.0       force the version (default from the commits: feat → minor, fix → patch, ! → major)
//   --pre beta                          prerelease: 1.3.0-beta.1, then -beta.2… ; a plain release finalizes it
//   --summary-fr "…" --summary-en "…"   one-line summary of the version (release notes card)
//   --commit                            commit at once, keeping the generated notes
//   --no-check                          skip `npm run check` (typecheck, lint, tests, build)
// tag
//   1.4.0                               the version main must be at (default: its package.json)
// both
//   --dry-run                           show what would happen, change nothing

import { execFileSync, spawnSync } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import {
  LANGS, RELEASE_FILES, bumpFor, changelogFile, extractSection, missingNotes, nextVersion, parseCommit,
  prepareStep, prependSection, releaseBranch, renderSection, tagProblems, unexpectedFiles
} from './lib/release.mjs'

const args = process.argv.slice(2)
const flag = name => args.includes(name)
const option = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const WITH_VALUE = ['--pre', '--summary-fr', '--summary-en']
const [mode, positional = null] = args.filter((a, i) => !a.startsWith('--') && !WITH_VALUE.includes(args[i - 1]))
const dryRun = flag('--dry-run')

const git = (...a) => execFileSync('git', a, { encoding: 'utf-8' }).trim()
// Quiet: null when git fails (no remote, offline, missing ref)
const tryGit = (...a) => {
  try { return execFileSync('git', a, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null }
}
const npm = (...a) => {
  // npm is a .cmd on Windows: needs a shell (arguments here are fixed or a checked version)
  const r = spawnSync('npm', a, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) fail(`npm ${a.join(' ')} failed`)
}
function fail(msg) { console.error(`\n✖ ${msg}`); process.exit(1) }

const readText = file => (existsSync(file) ? readFileSync(file, 'utf-8') : '')
const pkgVersion = () => JSON.parse(readFileSync('package.json', 'utf-8')).version
const sectionOf = (lang, version) => extractSection(readText(changelogFile(lang)), version)
// Staged, unstaged and untracked files
const changedFiles = () => [
  ...git('diff', '--name-only', 'HEAD').split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n')
].filter(Boolean)

/** How HEAD stands against origin/<name> after a fetch (null without a remote or offline) */
function againstOrigin(name) {
  if (tryGit('fetch', '--quiet', 'origin', name) === null) return null
  const counts = tryGit('rev-list', '--left-right', '--count', `origin/${name}...HEAD`)
  if (!counts) return null
  const [behind, ahead] = counts.split(/\s+/).map(Number)
  return { behind, ahead }
}

const repoUrl = tryGit('remote', 'get-url', 'origin')?.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '') ?? null
const branch = git('rev-parse', '--abbrev-ref', 'HEAD')

if (mode === 'prepare') prepare()
else if (mode === 'tag') tag()
else {
  fail([
    'Usage:',
    '  npm run release -- prepare [patch|minor|major|X.Y.Z] [--pre beta] [--summary-fr "…"] [--summary-en "…"] [--commit] [--no-check] [--dry-run]',
    '  npm run release -- tag [X.Y.Z] [--dry-run]',
    'Flow: docs/dev/versions.md, "Sortir une version".'
  ].join('\n'))
}

// ─── prepare ──────────────────────────────────────────────────────────────────

function prepare() {
  const current = pkgVersion()
  const dirty = changedFiles().length > 0
  let state = prepareStep({ branch, pkgVersion: current, dirty })
  if (state.step === 'error') {
    if (!dryRun) fail(state.message)
    console.warn(`(${state.message} Preview only.)`)
    state = { step: 'write', branchVersion: null }
  }
  if (state.step === 'done') {
    console.log(`\nv${state.version} is already prepared on ${branch}.`)
    return afterCommit(state.version)
  }
  if (state.step === 'commit') return commitRelease(state.version, branch)

  if (dirty && !dryRun) fail('Working tree is not clean: commit or stash first.')
  if (branch === 'develop') {
    const origin = againstOrigin('develop')
    if (origin?.behind && !dryRun) fail(`develop is ${origin.behind} commit(s) behind origin/develop: git pull first.`)
  }

  // Changes since the last tag (main merged back into develop brings it here)
  const lastTag = tryGit('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*')
  const SEP = '\x1f', END = '\x1e'
  const log = git('log', `--format=%H${SEP}%s${SEP}%b${END}`, ...(lastTag ? [`${lastTag}..HEAD`] : []))
  const changes = log.split(END).map(e => e.trim()).filter(Boolean)
    .map(e => { const [hash, subject, body] = e.split(SEP); return parseCommit(hash, subject, body) })
    .filter(Boolean)
  if (!changes.length && !positional) fail(`No change since ${lastTag ?? 'the beginning'}.`)

  const pre = option('--pre')
  const bump = positional ?? bumpFor(changes)
  const version = nextVersion(current, bump, pre)
  const target = state.branchVersion ? branch : releaseBranch(version)
  if (state.branchVersion && state.branchVersion !== version) {
    fail(`The commits give ${version}, the branch is ${branch}: pass ${state.branchVersion} to force it, or cut ${releaseBranch(version)} from develop.`)
  }
  if (tryGit('rev-parse', '-q', '--verify', `refs/tags/v${version}`)) {
    fail(`v${version} already exists: develop lacks it, main has to be merged back into develop first (PR main → develop).`)
  }
  if (!state.branchVersion && tryGit('rev-parse', '-q', '--verify', `refs/heads/${target}`)) fail(`Branch ${target} already exists.`)

  const previous = lastTag?.replace(/^v/, '') ?? null
  const sections = Object.fromEntries(LANGS.map(lang => [lang, renderSection(version, changes, { lang, repoUrl, previous, summary: option(`--summary-${lang}`) })]))

  console.log(`\n${current} → ${version}  (${positional ? bump : `${bump}, from ${changes.length} commit(s)`}${pre ? `, ${pre}` : ''}) on ${target}\n`)
  console.log(sections.fr)
  console.log(sections.en)
  for (const lang of LANGS) {
    const missing = missingNotes(changes, lang).length
    if (missing) console.log(`! ${missing} listed change(s) have no "${lang}:" line: ${changelogFile(lang)} shows their commit subject.`)
    if (!option(`--summary-${lang}`)) console.log(`! No --summary-${lang}: the release card has no summary in ${changelogFile(lang)}.`)
  }
  if (dryRun) return

  if (!flag('--no-check')) npm('run', 'check')
  if (!state.branchVersion) git('switch', '-c', target)
  npm('version', version, '--no-git-tag-version', '--allow-same-version')
  for (const lang of LANGS) {
    const file = changelogFile(lang)
    writeFileSync(file, prependSection(readText(file), sections[lang], lang))
  }
  npm('run', 'licenses')
  console.log(`\n✔ v${version} written on ${target}: ${RELEASE_FILES.join(', ')}`)

  if (flag('--commit')) return commitRelease(version, target)
  console.log([
    '',
    `Next: rewrite the v${version} sections of CHANGELOG.md and CHANGELOG.en.md for users`,
    '(by area, in each language), then commit the release with: npm run release -- prepare'
  ].join('\n'))
}

function commitRelease(version, onBranch) {
  const extra = unexpectedFiles(changedFiles())
  if (extra.length) fail(`The release commit holds the release files only. Also changed: ${extra.join(', ')}`)
  const missing = LANGS.filter(lang => !sectionOf(lang, version))
  if (missing.length) fail(`No ${version} section in ${missing.map(changelogFile).join(', ')}.`)

  console.log(`\nchore(release): v${version} on ${onBranch}`)
  if (dryRun) return
  git('add', '--', ...RELEASE_FILES.filter(f => existsSync(f)))
  git('commit', '-m', `chore(release): v${version}`)
  console.log(`✔ Committed chore(release): v${version}`)
  afterCommit(version)
}

function afterCommit(version) {
  console.log([
    'Next:',
    `  git push -u origin ${releaseBranch(version)}`,
    `  PR ${releaseBranch(version)} → main, merged with a merge commit (CI "check" must pass)`,
    `  then on main, pulled: npm run release -- tag ${version}`
  ].join('\n'))
}

// ─── tag ──────────────────────────────────────────────────────────────────────

function tag() {
  const current = pkgVersion()
  const version = (positional ?? current).replace(/^v/, '')
  const name = `v${version}`
  if (!dryRun && changedFiles().length) fail('Working tree is not clean: commit or stash first.')

  const origin = ['main', 'master'].includes(branch) ? againstOrigin(branch) : null
  const tagExists = !!tryGit('rev-parse', '-q', '--verify', `refs/tags/${name}`) || !!tryGit('ls-remote', '--tags', 'origin', `refs/tags/${name}`)
  const sections = Object.fromEntries(LANGS.map(lang => [lang, sectionOf(lang, version)]))
  const problems = tagProblems({ branch, version, pkgVersion: current, tagExists, behind: origin?.behind ?? 0, ahead: origin?.ahead ?? 0, sections })
  if (problems.length) fail(problems.join('\n  '))

  console.log(`\n${name} on ${branch} (${git('rev-parse', '--short', 'HEAD')}):\n`)
  console.log(sections.fr)
  if (dryRun) return

  // verbatim: the section's "##" headings are not comments
  git('tag', '-a', name, '--cleanup=verbatim', '-m', sections.fr)
  git('push', 'origin', `refs/tags/${name}`)
  console.log(`✔ Pushed ${name}: the Release workflow builds the installer and publishes the release${repoUrl ? ` (${repoUrl}/actions)` : ''}`)
  console.log('Last step: a PR main → develop, merged with a merge commit, so that develop has the version and the tag.')
}
