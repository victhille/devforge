// Versioning rules shared by the release script, the CI and the tests.
//
// Commits follow Conventional Commits (`feat(db): …`, `fix: …`, `feat!: …`).
// Older free-form messages ("Database: …", "Fix …") are classified by keyword.
// Bump: breaking → major, feat → minor, anything else → patch.

/** @typedef {'breaking' | 'feat' | 'fix' | 'security' | 'perf' | 'refactor' | 'docs' | 'test' | 'build' | 'ci' | 'chore' | 'style' | 'revert'} Kind */
/** @typedef {{ hash: string, kind: Kind, scope: string, subject: string, breaking: boolean }} Change */

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
  if (/^chore\(release\)/.test(subject) || /^Release \d/.test(subject)) return null
  const breakingBody = /^BREAKING[ -]CHANGE:/m.test(body)
  const m = subject.match(CONVENTIONAL)
  if (m && TYPES.has(m[1].toLowerCase())) {
    const breaking = !!m[3] || breakingBody
    return { hash, kind: breaking ? 'breaking' : /** @type {Kind} */ (m[1].toLowerCase()), scope: m[2] ?? '', subject: m[4], breaking }
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
  return { hash, kind: breakingBody ? 'breaking' : kind, scope: scope === 'security' ? '' : scope, subject: text, breaking: breakingBody }
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
  ['breaking', '⚠️ Changements majeurs'],
  ['feat', 'Nouveautés'],
  ['security', 'Sécurité'],
  ['fix', 'Corrections'],
  ['perf', 'Performances'],
  ['refactor', 'Améliorations internes'],
  ['build', 'Dépendances et build'],
  ['docs', 'Documentation']
])
const HIDDEN = new Set(['test', 'ci', 'chore', 'style', 'revert'])

/**
 * Markdown section for one version.
 * @param {string} version
 * @param {Change[]} changes
 * @param {{ date?: string, repoUrl?: string, previous?: string | null }} [opts]
 * @returns {string}
 */
export function renderSection(version, changes, opts = {}) {
  const date = opts.date ?? new Date().toISOString().slice(0, 10)
  const title = opts.repoUrl && opts.previous
    ? `## [${version}](${opts.repoUrl}/compare/v${opts.previous}...v${version}) — ${date}`
    : `## ${version} — ${date}`
  const lines = [title, '']
  for (const [kind, label] of SECTIONS) {
    const list = changes.filter(c => c.kind === kind)
    if (!list.length) continue
    lines.push(`### ${label}`, '')
    for (const c of list) {
      const hash = opts.repoUrl ? `([${c.hash.slice(0, 7)}](${opts.repoUrl}/commit/${c.hash}))` : `(${c.hash.slice(0, 7)})`
      lines.push(`- ${c.scope ? `**${c.scope}** : ` : ''}${capitalize(c.subject)} ${hash}`)
    }
    lines.push('')
  }
  const hidden = changes.filter(c => HIDDEN.has(c.kind)).length
  if (hidden) lines.push(`_${hidden} changement(s) technique(s) (tests, CI, maintenance) non listé(s)._`, '')
  if (lines.length === 2) lines.push('_Aucun changement notable._', '')
  return lines.join('\n')
}

const capitalize = (/** @type {string} */ s) => s.charAt(0).toUpperCase() + s.slice(1)

export const CHANGELOG_HEADER = '# Notes de version\n\nToutes les versions de DevForge. Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).\n'

/**
 * Insert a version section at the top of CHANGELOG.md content.
 * @param {string} existing
 * @param {string} section
 * @returns {string}
 */
export function prependSection(existing, section) {
  const body = existing.startsWith('# ') ? existing.slice(existing.indexOf('\n## ') + 1 || existing.length) : existing
  const rest = body.startsWith('## ') ? body : ''
  return `${CHANGELOG_HEADER}\n${section.trimEnd()}\n\n${rest}`.trimEnd() + '\n'
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
