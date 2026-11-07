import { describe, expect, it } from 'vitest'
import { parseVersion, satisfies } from '@shared/lib/semver'

describe('parseVersion', () => {
  it('reads full, partial and prefixed versions', () => {
    expect(parseVersion('v18.2.1')).toEqual([18, 2, 1])
    expect(parseVersion('20')).toEqual([20, 0, 0])
    expect(parseVersion('=8.3')).toEqual([8, 3, 0])
    expect(parseVersion('22.11.0-nightly')).toEqual([22, 11, 0])
    expect(parseVersion('lts/*')).toBeNull()
  })
})

describe('satisfies', () => {
  it.each([
    ['18.19.0', '18', true],
    ['19.0.0', '18', false],
    ['18.2.5', '18.2', true],
    ['18.3.0', '18.x', true],
    ['20.1.0', '>=18 <21', true],
    ['21.0.0', '>=18 <21', false],
    ['18.5.0', '^18.2', true],
    ['19.0.0', '^18.2', false],
    ['0.2.5', '^0.2.3', true],
    ['0.3.0', '^0.2.3', false],
    ['18.2.9', '~18.2', true],
    ['18.3.0', '~18.2', false],
    ['20.0.0', '18 || 20', true],
    ['19.0.0', '18 || 20', false],
    ['8.2.0', '>= 8.1', true],
    ['1.5.0', '1.2 - 2.3', true],
    ['2.4.0', '1.2 - 2.3', false],
    ['5.0.0', '*', true]
  ])('%s in %s → %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected)
  })

  it('returns null when the range is not understood', () => {
    expect(satisfies('18.0.0', 'lts/*')).toBeNull()
    expect(satisfies('not-a-version', '18')).toBeNull()
  })
})
