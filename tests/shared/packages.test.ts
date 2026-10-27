import { describe, expect, it } from 'vitest'
import { fitsRange, isPackageName, rangeFloor, updateLevel } from '@shared/lib/packages'

describe('package rules (v3.3 lot 2)', () => {
  it('says how far a version is from the latest one', () => {
    expect(updateLevel('1.2.3', '1.2.3')).toBe('current')
    expect(updateLevel('1.2.3', '1.2.9')).toBe('patch')
    expect(updateLevel('1.2.3', '1.4.0')).toBe('minor')
    expect(updateLevel('1.2.3', '2.0.0')).toBe('major')
    expect(updateLevel('2.0.0', '1.9.0')).toBe('current')
    expect(updateLevel(null, '1.0.0')).toBe('unknown')
    expect(updateLevel('1.0.0', null)).toBe('unknown')
  })

  it('reads where a range starts, and whether a version fits it', () => {
    expect(rangeFloor('^1.2.0')).toBe('1.2.0')
    expect(rangeFloor('~3.1')).toBe('3.1')
    expect(rangeFloor('>=18 <21')).toBe('18')
    expect(rangeFloor('*')).toBeNull()
    expect(rangeFloor('github:user/repo')).toBeNull()
    expect(fitsRange('1.9.0', '^1.2.0')).toBe(true)
    expect(fitsRange('2.0.0', '^1.2.0')).toBe(false)
    expect(fitsRange(null, '^1.2.0')).toBe(false)
  })

  it('takes only real package names: nothing a shell could run', () => {
    for (const ok of ['react', '@types/node', 'lodash.merge', '@scope/a-b_c']) expect(isPackageName(ok)).toBe(true)
    for (const bad of ['React', 'a b', 'x;rm -rf /', '$(evil)', '`evil`', 'a&b', '../x', '', '@scope/', 'a|b']) expect(isPackageName(bad)).toBe(false)
    expect(isPackageName('symfony/console', true)).toBe(true)
    expect(isPackageName('laravel/framework', true)).toBe(true)
    expect(isPackageName('react', true)).toBe(false)
    expect(isPackageName('a/b;evil', true)).toBe(false)
  })
})
