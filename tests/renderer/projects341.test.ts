import { describe, expect, it } from 'vitest'
import { frameworkFilters } from '@renderer/features/projects/hooks/useProjects'
import { IDE_LABEL } from '@renderer/lib/ide'

/** 3.4.1: the Projects tab shows only the frameworks you have, and buttons name the chosen IDE */
describe('3.4.1: projects tab', () => {
  it('keeps one filter per framework present, by name, Laravel included', () => {
    expect(frameworkFilters(['symfony', 'react', 'laravel', 'react', 'unknown', 'nextjs'])).toEqual(['laravel', 'nextjs', 'react', 'symfony'])
    expect(frameworkFilters([])).toEqual([])
  })

  it('names each IDE, and none for "no IDE"', () => {
    expect(IDE_LABEL.phpstorm).toBe('PhpStorm')
    expect(IDE_LABEL.none).toBeNull()
  })
})
