// Versioning rules shared by the release script, the CI and the tests.
//
// Commits follow Conventional Commits (`feat(db): …`, `fix: …`, `feat!: …`).
// Older free-form messages ("Database: …", "Fix …") are classified by keyword.
// Bump: breaking → major, feat → minor, anything else → patch.
//
// The changelog exists in French (CHANGELOG.md) and English (CHANGELOG.en.md).
// A commit gives its user-facing text per language with body lines
// `fr: …` and `en: …`; without them the subject is used in both.

/** @typedef {'breaking' | 'feat' | 'fix' | 'security' | 'perf' | 'refactor' | 'docs' | 'test' | 'build' | 'ci' | 'chore' | 'style' | 'revert'} Kind */
/** @typedef {'fr' | 'en'} Lang */
/** @typedef {{ hash: string, kind: Kind, scope: string, subject: string, breaking: boolean, notes: Partial<Record<Lang, string>> }} Change */

export const LANGS = /** @type {const} */ (['fr', 'en'])

/** Changelog file of a language */
export const changelogFile = (/** @type {Lang} */ lang) => (lang === 'fr' ? 'CHANGELOG.md' : `CHANGELOG.${lang}.md`)

/**
 * `fr: …` / `en: …` lines of a commit body
 * @param {string} body
 * @returns {Partial<Record<Lang, string>>}
 */
function notesOf(body) {
  /** @type {Partial<Record<Lang, string>>} */
  const notes = {}
  for (const lang of LANGS) {
    const m = body.match(new RegExp(`^${lang}:\\s*(.+)$`, 'mi'))
    if (m) notes[lang] = m[1].trim()
  }
  return notes
}

/**
 * Text of a change in one language
 * @param {Change} c
 * @param {Lang} lang
 */
export const textOf = (c, lang) => c.notes?.[lang] ?? c.subject

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/
const TYPES = new Set(['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'build', 'ci', 'chore', 'style', 'revert', 'security'])

/**
 * One commit → change. `body` is scanned for "BREAKING CHANGE:".
 * @param {string} hash
 * @param {string} subject
 * @param {string} [body]
 * @returns {Change | null} null for release commits (they are not changes)
 */
export function parseCommit(hash, subject, body = '') {
  subject = subject.trim()
  if (/^chore\(release\): v?\d/.test(subject) || /^Release \d/.test(subject)) return null
  // A merge brings changes that have their own commits
  if (/^Merge (pull request|branch|remote-tracking branch)\b/.test(subject)) return null
  const breakingBody = /^BREAKING[ -]CHANGE:/m.test(body)
  const notes = notesOf(body)
  const m = subject.match(CONVENTIONAL)
  if (m && TYPES.has(m[1].toLowerCase())) {
    const breaking = !!m[3] || breakingBody
    // The website (site/) is not in the app: counted with the repository docs, not in the in-app notes
    const kind = breaking ? 'breaking' : m[2] === 'site' ? 'docs' : /** @type {Kind} */ (m[1].toLowerCase())
    return { hash, kind, scope: m[2] ?? '', subject: m[4], breaking, notes }
  }
  // Free-form history: "Area: what changed" or a plain sentence
  // "Area: …" unless the "area" is already a sentence ("Fix remote scripts: …")
  const sentence = /^(fix|add|remove|update|upgrade|use|make|move)\b/i.test(subject)
  const area = sentence ? null : subject.match(/^([A-Z][\w ./-]{1,30}):\s+(.+)$/)
  const scope = area ? area[1].toLowerCase() : ''
  const text = area ? area[2] : subject
  /** @type {Kind} */
  let kind = 'feat'
  if (/^security\b/i.test(subject)) kind = 'security'
  else if (/^(fix|fixes|fixed|bugfix)\b/i.test(text) || /^fix\b/i.test(subject)) kind = 'fix'
  else if (/^(upgrade|bump|update deps)/i.test(text)) kind = 'build'
  else if (/^(refactor|clean ?up|rename|move|restructure|normalize|convert|silence)\b/i.test(text)) kind = 'refactor'
  else if (/^(docs?|readme)\b/i.test(text)) kind = 'docs'
  else if (/^tests?\b/i.test(text)) kind = 'test'
  // Technical commit that also fixes user-visible bugs: worth listing
  if (['test', 'docs', 'build'].includes(kind) && /\bfix(es|ed)?\b/i.test(subject)) kind = 'fix'
  return { hash, kind: breakingBody ? 'breaking' : kind, scope: scope === 'security' ? '' : scope, subject: text, breaking: breakingBody, notes }
}

/**
 * @param {string} v
 * @returns {{ major: number, minor: number, patch: number, pre: string | null, preNum: number | null }}
 */
export function parseSemver(v) {
  const m = v.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+)(?:\.(\d+))?)?$/)
  if (!m) throw new Error(`Not a semver version: ${v}`)
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] ?? null, preNum: m[5] !== undefined ? +m[5] : null }
}

/**
 * Bump implied by a list of changes.
 * @param {Change[]} changes
 * @returns {'major' | 'minor' | 'patch'}
 */
export function bumpFor(changes) {
  if (changes.some(c => c.breaking)) return 'major'
  if (changes.some(c => c.kind === 'feat')) return 'minor'
  return 'patch'
}

/**
 * Next version. `bump` is major/minor/patch or an explicit x.y.z.
 * With `pre` ("beta"…): 1.2.0 → 1.3.0-beta.1 → 1.3.0-beta.2; without it, a
 * prerelease is finalized (1.3.0-beta.2 → 1.3.0).
 * @param {string} current
 * @param {'major' | 'minor' | 'patch' | string} bump
 * @param {string | null} [pre]
 * @returns {string}
 */
export function nextVersion(current, bump, pre = null) {
  if (/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(bump)) return bump
  const c = parseSemver(current)
  const base = (/** @type {{major:number,minor:number,patch:number}} */ v) => `${v.major}.${v.minor}.${v.patch}`

  if (c.pre) {
    // Already a prerelease of the next version: the bump is already "spent"
    if (pre) return c.pre === pre && c.preNum !== null ? `${base(c)}-${pre}.${c.preNum + 1}` : `${base(c)}-${pre}.1`
    return base(c)
  }
  const n = { ...c }
  if (bump === 'major') { n.major++; n.minor = 0; n.patch = 0 }
  else if (bump === 'minor') { n.minor++; n.patch = 0 }
  else if (bump === 'patch') n.patch++
  else throw new Error(`Unknown bump: ${bump}`)
  return pre ? `${base(n)}-${pre}.1` : base(n)
}

/** Changelog sections, in display order */
export const SECTIONS = /** @type {const} */ ([
  ['breaking', { fr: '⚠️ Changements majeurs', en: '⚠️ Breaking changes' }],
  ['feat', { fr: 'Nouveautés', en: 'New features' }],
  ['security', { fr: 'Sécurité', en: 'Security' }],
  ['fix', { fr: 'Corrections', en: 'Fixes' }],
  ['perf', { fr: 'Performances', en: 'Performance' }],
  ['refactor', { fr: 'Améliorations internes', en: 'Internal improvements' }],
  ['build', { fr: 'Dépendances et build', en: 'Dependencies and build' }]
])
// Not for app users: repository docs, tests, tooling
const HIDDEN = new Set(['docs', 'test', 'ci', 'chore', 'style', 'revert'])

const TEXT = {
  fr: {
    hidden: (/** @type {number} */ n) => `_${n} changement(s) technique(s) (tests, CI, documentation du dépôt) non listé(s)._`,
    none: '_Aucun changement notable._',
    header: '# Notes de version\n\nToutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).\n'
  },
  en: {
    hidden: (/** @type {number} */ n) => `_${n} technical change(s) (tests, CI, repository docs) not listed._`,
    none: '_No notable change._',
    header: '# Release notes\n\nEvery DevForge version. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), [SemVer](https://semver.org/) versions.\n'
  }
}

/**
 * Markdown section for one version, in one language.
 * @param {string} version
 * @param {Change[]} changes
 * @param {{ lang?: Lang, date?: string, repoUrl?: string | null, previous?: string | null }} [opts]
 * @returns {string}
 */
export function renderSection(version, changes, opts = {}) {
  const lang = opts.lang ?? 'fr'
  const date = opts.date ?? new Date().toISOString().slice(0, 10)
  const title = opts.repoUrl && opts.previous
    ? `## [${version}](${opts.repoUrl}/compare/v${opts.previous}...v${version}) — ${date}`
    : `## ${version} — ${date}`
  const lines = [title, '']
  // One-line summary shown on the release card and in "What's new"
  if (opts.summary) lines.push(`> ${opts.summary}`, '')
  for (const [kind, label] of SECTIONS) {
    const list = changes.filter(c => c.kind === kind)
    if (!list.length) continue
    lines.push(`### ${label[lang]}`, '')
    for (const c of list) {
      const hash = opts.repoUrl ? `([${c.hash.slice(0, 7)}](${opts.repoUrl}/commit/${c.hash}))` : `(${c.hash.slice(0, 7)})`
      // French typography: space before the colon
      lines.push(`- ${c.scope ? `**${c.scope}**${lang === 'fr' ? ' :' : ':'} ` : ''}${capitalize(textOf(c, lang))} ${hash}`)
    }
    lines.push('')
  }
  const hidden = changes.filter(c => HIDDEN.has(c.kind)).length
  if (hidden) lines.push(TEXT[lang].hidden(hidden), '')
  if (lines.length === 2) lines.push(TEXT[lang].none, '')
  return lines.join('\n')
}

const capitalize = (/** @type {string} */ s) => s.charAt(0).toUpperCase() + s.slice(1)

export const changelogHeader = (/** @type {Lang} */ lang) => TEXT[lang].header

/**
 * Insert a version section at the top of a changelog.
 * @param {string} existing
 * @param {string} section
 * @param {Lang} [lang]
 * @returns {string}
 */
export function prependSection(existing, section, lang = 'fr') {
  const body = existing.startsWith('# ') ? existing.slice(existing.indexOf('\n## ') + 1 || existing.length) : existing
  const rest = body.startsWith('## ') ? body : ''
  return `${TEXT[lang].header}\n${section.trimEnd()}\n\n${rest}`.trimEnd() + '\n'
}

/**
 * Section of one version from CHANGELOG.md content (for release notes).
 * @param {string} changelog
 * @param {string} version
 * @returns {string | null}
 */
export function extractSection(changelog, version) {
  const parts = changelog.split(/\n(?=## )/)
  const hit = parts.find(p => new RegExp(`^## \\[?${version.replace(/\./g, '\\.')}[\\] ]`).test(p))
  return hit ? hit.trim() + '\n' : null
}
