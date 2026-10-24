import { describe, expect, it } from 'vitest'
import { DEFAULT_FAVORITES, LISTED_PAGES, MENU_GROUPS, groupOf } from '@renderer/app/navigation'

describe('sidebar menu', () => {
  it('lists every page exactly once (Home, groups or Settings), so an unpinned favorite stays reachable', () => {
    const placed = ['/', ...MENU_GROUPS.flatMap(g => g.paths), '/settings']
    const pages = ['/', ...LISTED_PAGES.map(p => p.path)]
    expect([...placed].sort()).toEqual([...pages].sort())
    expect(new Set(placed).size).toBe(placed.length)
    // A group stays short
    for (const g of MENU_GROUPS) expect(g.paths.length).toBeLessThanOrEqual(5)
    for (const p of DEFAULT_FAVORITES) expect(placed).toContain(p)
  })

  it('finds the group of a route, detail pages included', () => {
    expect(groupOf('/git')).toBe('groupDev')
    expect(groupOf('/vps/abc')).toBe('groupServers')
    expect(groupOf('/docker')).toBe('groupDev')
    expect(groupOf('/vpn')).toBe('groupOnline')
    expect(groupOf('/logs')).toBe('groupData')
    expect(groupOf('/')).toBeNull()
  })
})
