import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({ app: { getPath: () => '' } }))

const { testFilter } = await import('../../src/main/services/tests/testRunner')
const isWin = process.platform === 'win32'
const q = (s: string) => (isWin ? `"${s}"` : `'${s}'`)

/** Relaunching one test: its name reaches the shell only in plain words, escaped for each tool */
describe('testFilter', () => {
  it('keeps one test by its name, as a pattern', () => {
    expect(testFilter('vitest', 'calcule la TVA à 20 %'.replace(' %', ''))).toBe(` -t ${q('calcule la TVA à 20')}`)
    expect(testFilter('jest', 'total (2 items)')).toBe(` -t ${q('total \\(2 items\\)')}`)
    expect(testFilter('playwright', 'opens the home')).toBe(` -g ${q('opens the home')}`)
    expect(testFilter('phpunit', 'testTotal')).toBe(` --filter ${q('testTotal')}`)
  })

  it('takes only identifiers where the tool needs one', () => {
    expect(testFilter('pytest', 'test_total')).toBe(` -k ${q('test_total')}`)
    expect(testFilter('pytest', 'a total')).toBe('')
    expect(testFilter('go', 'TestTotal')).toBe(` -run ${q('^TestTotal$')}`)
    expect(testFilter('cargo', 'cart::tests::total')).toBe(` ${q('cart::tests::total')}`)
  })

  it('never lets a name with shell characters through: the whole file runs instead', () => {
    for (const name of ['a" & calc', 'x %PATH% y', 'a | b', 'a > out.txt', 'a`whoami`', '$(rm -rf /)', 'a^b', 'a!b', ''])
      expect(testFilter('vitest', name)).toBe('')
    expect(testFilter('vitest', undefined)).toBe('')
  })
})
