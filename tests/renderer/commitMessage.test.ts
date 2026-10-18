import { describe, expect, it } from 'vitest'
import type { GitFileChange } from '@shared/types'
import { formatCommit, guessScope, guessType, suggestCommit } from '@renderer/features/git/commitMessage'

const ch = (path: string, status: GitFileChange['status'] = 'modified') => ({ path, status, staged: true }) as GitFileChange

describe('commit message suggestions', () => {
  it('guesses the type from the files', () => {
    expect(guessType([ch('README.md'), ch('docs/setup.md')])).toBe('docs')
    expect(guessType([ch('src/a.test.ts')])).toBe('test')
    expect(guessType([ch('.github/workflows/ci.yml')])).toBe('ci')
    expect(guessType([ch('package.json'), ch('package-lock.json')])).toBe('build')
    expect(guessType([ch('src/new.ts', 'added')])).toBe('feat')
    expect(guessType([ch('src/old.ts', 'deleted')])).toBe('refactor')
    expect(guessType([ch('src/a.ts')])).toBe('fix')
  })

  it('uses the most specific non-generic folder as scope', () => {
    expect(guessScope(['src/renderer/src/features/database/A.tsx', 'src/renderer/src/features/database/B.tsx'])).toBe('database')
    expect(guessScope(['src/a.ts', 'lib/b.ts'])).toBe('')
    expect(guessScope(['src/index.ts'])).toBe('index')
  })

  it('formats a conventional commit', () => {
    const s = suggestCommit([ch('package.json')])
    expect(formatCommit(s)).toBe('build(package): update dependencies')
    expect(formatCommit({ type: 'fix', scope: '', subject: ' x ' }, 'body')).toBe('fix: x\n\nbody')
  })
})
