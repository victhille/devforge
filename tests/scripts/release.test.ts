import { describe, expect, it } from 'vitest'
import {
  RELEASE_FILES, bumpFor, changelogFile, extractSection, missingNotes, nextVersion, parseCommit, prepareStep,
  prependSection, releaseBranch, renderSection, tagProblems, unexpectedFiles, versionOfBranch
} from '../../scripts/lib/release.mjs'

describe('parseCommit', () => {
  it('reads conventional commits', () => {
    expect(parseCommit('a1', 'feat(db): table explorer')).toMatchObject({ kind: 'feat', scope: 'db', subject: 'table explorer', breaking: false })
    expect(parseCommit('a2', 'fix: crash on stop')).toMatchObject({ kind: 'fix', scope: '' })
    expect(parseCommit('a3', 'feat!: new storage')).toMatchObject({ kind: 'breaking', breaking: true })
    expect(parseCommit('a4', 'refactor(ssh): x', 'BREAKING CHANGE: config moved')).toMatchObject({ kind: 'breaking' })
  })

  it('leaves merges out, and counts the website with the repository docs', () => {
    expect(parseCommit('m1', 'Merge pull request #4 from someone/branch')).toBeNull()
    expect(parseCommit('m2', "Merge remote-tracking branch 'origin/main' into feature")).toBeNull()
    expect(parseCommit('m3', "Merge branch 'main'")).toBeNull()
    expect(parseCommit('s1', 'feat(site): page 404 (#6)')).toMatchObject({ kind: 'docs', scope: 'site' })
    expect(parseCommit('s2', 'feat(sites): not the website')).toMatchObject({ kind: 'feat' })
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
    expect(file.match(/^## \[Non publié\]/gm)).toHaveLength(1)
    expect(file.indexOf('## [Non publié]')).toBeLessThan(file.indexOf('## 1.2.0'))
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

  it('points out the listed changes whose notes must be rewritten by hand', () => {
    const french = parseCommit('e', 'fix(ssh): oublier le mot de passe')!
    const hidden = parseCommit('f', 'test: plus de cas')!
    expect(missingNotes([c, french, hidden], 'en')).toEqual([french])
    expect(missingNotes([c, french, hidden], 'fr')).toEqual([french])
    expect(missingNotes([c], 'en')).toEqual([])
  })
})

describe('release through pull requests', () => {
  it('names release branches after their version', () => {
    expect(releaseBranch('1.4.0')).toBe('release/1.4.0')
    expect(versionOfBranch('release/1.4.0')).toBe('1.4.0')
    expect(versionOfBranch('release/2.0.0-beta.1')).toBe('2.0.0-beta.1')
    expect(versionOfBranch('release/v1.4.0')).toBeNull()
    expect(versionOfBranch('release/next')).toBeNull()
    expect(versionOfBranch('hotfix/1.4.1')).toBeNull()
    expect(versionOfBranch('develop')).toBeNull()
  })

  it('prepares on develop or on a release branch, never on main', () => {
    expect(prepareStep({ branch: 'develop', pkgVersion: '0.2.0', dirty: false })).toEqual({ step: 'write', branchVersion: null })
    expect(prepareStep({ branch: 'release/0.3.0', pkgVersion: '0.2.0', dirty: false })).toEqual({ step: 'write', branchVersion: '0.3.0' })
    for (const branch of ['main', 'master', 'feat/notes', 'release/next']) {
      expect(prepareStep({ branch, pkgVersion: '0.2.0', dirty: false })).toMatchObject({ step: 'error' })
    }
  })

  it('commits once the release is written and its notes rewritten', () => {
    expect(prepareStep({ branch: 'release/0.3.0', pkgVersion: '0.3.0', dirty: true })).toEqual({ step: 'commit', version: '0.3.0' })
    expect(prepareStep({ branch: 'release/0.3.0', pkgVersion: '0.3.0', dirty: false })).toEqual({ step: 'done', version: '0.3.0' })
  })

  it('keeps the release commit to the release files', () => {
    expect(RELEASE_FILES).toEqual(['package.json', 'package-lock.json', 'CHANGELOG.md', 'CHANGELOG.en.md', 'THIRD_PARTY_LICENSES.md'])
    expect(unexpectedFiles(['package.json', 'CHANGELOG.en.md', 'THIRD_PARTY_LICENSES.md'])).toEqual([])
    expect(unexpectedFiles(['CHANGELOG.md', 'src/main/index.ts', 'docs\\dev\\versions.md'])).toEqual(['src/main/index.ts', 'docs\\dev\\versions.md'])
  })

  describe('tag', () => {
    const ready = {
      branch: 'main', version: '0.3.0', pkgVersion: '0.3.0', tagExists: false, behind: 0, ahead: 0,
      sections: { fr: '## 0.3.0 — 2026-11-10\n', en: '## 0.3.0 — 2026-11-10\n' }
    }

    it('tags main once the release PR is merged and pulled', () => {
      expect(tagProblems(ready)).toEqual([])
    })

    it('refuses anywhere else, or before the merge', () => {
      expect(tagProblems({ ...ready, branch: 'release/0.3.0' })).toEqual([expect.stringContaining('Tag on main')])
      expect(tagProblems({ ...ready, pkgVersion: '0.2.0' })).toEqual([expect.stringContaining('package.json says 0.2.0, not 0.3.0')])
      expect(tagProblems({ ...ready, behind: 2 })).toEqual([expect.stringContaining('git pull')])
      expect(tagProblems({ ...ready, ahead: 1 })).toEqual([expect.stringContaining('only takes pull requests')])
    })

    it('never tags twice, nor without both sections', () => {
      expect(tagProblems({ ...ready, tagExists: true })).toEqual([expect.stringContaining('v0.3.0 already exists')])
      expect(tagProblems({ ...ready, sections: { fr: ready.sections.fr, en: null } })).toEqual(['No 0.3.0 section in CHANGELOG.en.md.'])
    })
  })
})
