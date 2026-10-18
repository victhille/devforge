import { describe, expect, it } from 'vitest'
import {
  bumpFor, changelogFile, extractSection, nextVersion, parseCommit, prependSection, renderSection
} from '../../scripts/lib/release.mjs'

describe('parseCommit', () => {
  it('reads conventional commits', () => {
    expect(parseCommit('a1', 'feat(db): table explorer')).toMatchObject({ kind: 'feat', scope: 'db', subject: 'table explorer', breaking: false })
    expect(parseCommit('a2', 'fix: crash on stop')).toMatchObject({ kind: 'fix', scope: '' })
    expect(parseCommit('a3', 'feat!: new storage')).toMatchObject({ kind: 'breaking', breaking: true })
    expect(parseCommit('a4', 'refactor(ssh): x', 'BREAKING CHANGE: config moved')).toMatchObject({ kind: 'breaking' })
  })

  it('classifies older free-form messages', () => {
    expect(parseCommit('b1', 'Database: reach DBs through SSH')).toMatchObject({ kind: 'feat', scope: 'database' })
    expect(parseCommit('b2', 'Fix remote detection scripts')).toMatchObject({ kind: 'fix' })
    expect(parseCommit('b3', 'Security: verify SSH server keys')).toMatchObject({ kind: 'security', scope: '' })
    expect(parseCommit('b4', 'Upgrade Electron 29 -> 44')).toMatchObject({ kind: 'build' })
    expect(parseCommit('b5', 'Docker: Fix compose tags')).toMatchObject({ kind: 'fix', scope: 'docker' })
    expect(parseCommit('b6', 'Fix remote detection scripts: quote them')).toMatchObject({ kind: 'fix', scope: '', subject: 'Fix remote detection scripts: quote them' })
    expect(parseCommit('b7', 'Tests, lint and CI; fix bugs they found')).toMatchObject({ kind: 'fix' })
  })

  it('skips release commits', () => {
    expect(parseCommit('c1', 'chore(release): v1.2.0')).toBeNull()
    expect(parseCommit('c2', 'Release 1.1.0')).toBeNull()
    expect(parseCommit('c3', 'chore(release): tweak the notes')).toMatchObject({ kind: 'chore' })
  })
})

describe('versions', () => {
  const ch = (kind: string, breaking = false) => ({ hash: 'h', kind, scope: '', subject: 's', breaking }) as never

  it('bump follows the most important change', () => {
    expect(bumpFor([ch('fix'), ch('docs')])).toBe('patch')
    expect(bumpFor([ch('fix'), ch('feat')])).toBe('minor')
    expect(bumpFor([ch('feat'), ch('breaking', true)])).toBe('major')
    expect(bumpFor([])).toBe('patch')
  })

  it.each([
    ['1.1.0', 'patch', null, '1.1.1'],
    ['1.1.0', 'minor', null, '1.2.0'],
    ['1.1.9', 'major', null, '2.0.0'],
    ['1.1.0', 'minor', 'beta', '1.2.0-beta.1'],
    ['1.2.0-beta.1', 'minor', 'beta', '1.2.0-beta.2'],
    ['1.2.0-beta.3', 'patch', 'rc', '1.2.0-rc.1'],
    ['1.2.0-rc.2', 'minor', null, '1.2.0'],
    ['1.1.0', '3.0.0', null, '3.0.0']
  ])('%s + %s (%s) → %s', (current, bump, pre, expected) => {
    expect(nextVersion(current, bump, pre)).toBe(expected)
  })

  it('rejects nonsense', () => {
    expect(() => nextVersion('banana', 'minor')).toThrow()
    expect(() => nextVersion('1.0.0', 'huge')).toThrow()
  })
})

describe('changelog', () => {
  const changes = [
    parseCommit('1111111aaaa', 'feat(db): explorer like phpMyAdmin')!,
    parseCommit('2222222bbbb', 'fix: cron day 7')!,
    parseCommit('3333333cccc', 'Security: verify SSH keys')!,
    parseCommit('4444444dddd', 'test: more tests')!
  ]

  it('groups changes by section with links', () => {
    const md = renderSection('1.2.0', changes, { date: '2026-10-18', repoUrl: 'https://github.com/me/app', previous: '1.1.0' })
    expect(md).toContain('## [1.2.0](https://github.com/me/app/compare/v1.1.0...v1.2.0) — 2026-10-18')
    expect(md.indexOf('### Nouveautés')).toBeLessThan(md.indexOf('### Sécurité'))
    expect(md.indexOf('### Sécurité')).toBeLessThan(md.indexOf('### Corrections'))
    expect(md).toContain('- **db** : Explorer like phpMyAdmin ([1111111](https://github.com/me/app/commit/1111111aaaa))')
    expect(md).toContain('1 changement(s) technique(s)')
    expect(md).not.toContain('more tests')
  })

  it('prepends new versions and extracts one back', () => {
    const v1 = renderSection('1.1.0', [changes[1]], { date: '2026-10-01' })
    const v2 = renderSection('1.2.0', [changes[0]], { date: '2026-10-18' })
    const file = prependSection(prependSection('', v1), v2)
    expect(file.startsWith('# Notes de version')).toBe(true)
    expect(file.indexOf('## 1.2.0')).toBeLessThan(file.indexOf('## 1.1.0'))
    expect(file.match(/^# Notes de version/gm)).toHaveLength(1)
    expect(extractSection(file, '1.1.0')).toContain('Cron day 7')
    expect(extractSection(file, '1.1.0')).not.toContain('Explorer')
    expect(extractSection(file, '9.9.9')).toBeNull()
  })
})

describe('bilingual notes', () => {
  const c = parseCommit('abc1234def', 'feat(db): table explorer', 'Longer explanation.\n\nfr: explorateur de tables\nen: table explorer like phpMyAdmin')!

  it('reads fr: and en: lines from the commit body', () => {
    expect(c.notes).toEqual({ fr: 'explorateur de tables', en: 'table explorer like phpMyAdmin' })
    expect(parseCommit('x', 'fix: crash')?.notes).toEqual({})
  })

  it('renders each language with its own headings and text', () => {
    const fr = renderSection('1.0.0', [c], { lang: 'fr', date: '2026-01-01' })
    const en = renderSection('1.0.0', [c], { lang: 'en', date: '2026-01-01' })
    expect(fr).toContain('### Nouveautés')
    expect(fr).toContain('- **db** : Explorateur de tables (abc1234)')
    expect(en).toContain('### New features')
    expect(en).toContain('- **db**: Table explorer like phpMyAdmin (abc1234)')
  })

  it('falls back to the subject when a language is missing', () => {
    const only = parseCommit('d', 'fix(ssh): reconnect', 'fr: reconnexion')!
    expect(renderSection('1.0.1', [only], { lang: 'en' })).toContain('Reconnect')
  })

  it('keeps the header of the right language', () => {
    expect(prependSection('', renderSection('1.0.0', [c], { lang: 'en' }), 'en').startsWith('# Release notes')).toBe(true)
    expect(changelogFile('fr')).toBe('CHANGELOG.md')
    expect(changelogFile('en')).toBe('CHANGELOG.en.md')
  })
})
