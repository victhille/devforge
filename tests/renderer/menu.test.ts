import { describe, expect, it } from 'vitest'
import { FAVORITES, LISTED_PAGES, MENU_GROUPS, groupOf } from '@renderer/app/navigation'

describe('sidebar menu', () => {
  it('lists every page exactly once (favorites, groups or Settings)', () => {
    const placed = [...FAVORITES, ...MENU_GROUPS.flatMap(g => g.paths), '/settings']
    const pages = ['/', ...LISTED_PAGES.map(p => p.path)]
    expect([...placed].sort()).toEqual([...pages].sort())
    expect(new Set(placed).size).toBe(placed.length)
  })

  it('finds the group of a route, detail pages included', () => {
    expect(groupOf('/git')).toBe('groupDev')
    expect(groupOf('/vps/abc')).toBe('groupServers')
    expect(groupOf('/docker')).toBeNull()
    expect(groupOf('/')).toBeNull()
  })
})
