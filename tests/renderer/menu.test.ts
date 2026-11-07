import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { DEFAULT_FAVORITES, LISTED_PAGES, MENU_GROUPS, RAIL, groupOf, panelFor, parentOf, railOf } from '@renderer/app/navigation'
import Sidebar from '@renderer/components/layout/Sidebar'

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
    expect(groupOf('/docker')).toBe('groupOnline')
    expect(groupOf('/activity')).toBe('groupDev')
    expect(groupOf('/vpn')).toBe('groupOnline')
    expect(groupOf('/logs')).toBe('groupData')
    expect(groupOf('/project/p1')).toBe('groupDev')
    expect(groupOf('/model')).toBe('groupData')
    expect(groupOf('/')).toBeNull()
  })

  it('the rail holds Home then the six groups, and knows which one holds a route', () => {
    expect(RAIL.map(r => r.key)).toEqual(['home', ...MENU_GROUPS.map(g => g.key)])
    expect(railOf('/')).toBe('home')
    expect(railOf('/ports')).toBe('groupSystem')
    expect(railOf('/settings')).toBeNull()
    expect(parentOf('/project/p1')).toBe('/projects')
    expect(parentOf('/vps/abc')).toBe('/ssh')
    expect(parentOf('/diff')).toBe('/diff')
  })

  it('the panel follows the page, unless the one shown already lists it', () => {
    const favs = ['/projects', '/docker']
    // Opened from elsewhere: the page brings its group
    expect(panelFor('groupTools', '/ports', favs)).toBe('groupSystem')
    expect(panelFor('groupDev', '/', favs)).toBe('home')
    // Picked in the panel: it stays (a favorite under Home, a detail page in its group)
    expect(panelFor('home', '/docker', favs)).toBe('home')
    expect(panelFor('home', '/project/p1', favs)).toBe('home')
    expect(panelFor('groupDev', '/project/p1', favs)).toBe('groupDev')
    expect(panelFor('home', '/git', favs)).toBe('groupDev')
    // Settings has no group: the panel does not move
    expect(panelFor('groupData', '/settings', favs)).toBe('groupData')
  })
})

describe('Sidebar', () => {
  (globalThis as Record<string, unknown>).__APP_VERSION__ = '9.9.9'
  // React Router's links warn that their layout effects do nothing in a static render
  beforeAll(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterAll(() => { vi.restoreAllMocks() })
  const at = (path: string) => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, h(Sidebar)))
  const button = (out: string, name: string) => out.match(new RegExp(`<button[^>]*aria-label="${name}"[^>]*>`))?.[0] ?? ''
  const link = (out: string, name: string) => out.match(new RegExp(`<a[^>]*>(?:(?!</a>).)*<span[^>]*>${name}</span></a>`))?.[0] ?? ''

  it('shows the group of the page on screen in the panel, its page marked, the others one click away', () => {
    const out = at('/git')
    expect(out).toContain('aria-label="Main menu"')
    expect(out).toContain('role="toolbar"')
    // The group's button says its panel is shown; it is the rail's one Tab stop
    expect(button(out, 'Development')).toContain('aria-pressed="true"')
    expect(button(out, 'Development')).toContain('tabindex="0"')
    expect(button(out, 'Tools')).toContain('aria-pressed="false"')
    expect(button(out, 'Tools')).toContain('tabindex="-1"')
    // Its five pages, Git marked as the page on screen
    for (const name of ['Projects', 'New Project', 'Git', 'Activity', 'Launcher']) expect(link(out, name)).not.toBe('')
    expect(link(out, 'Git')).toContain('aria-current="page"')
    expect(link(out, 'Projects')).not.toContain('aria-current')
    // Settings at the bottom, and the panel folds
    expect(out).toMatch(/<a[^>]*aria-label="Settings"/)
    expect(button(out, 'Fold the panel')).toContain('aria-expanded="true"')
  })

  it('under Home, the favorites; a detail page marks its parent', () => {
    const home = at('/')
    expect(button(home, 'Home')).toContain('aria-pressed="true"')
    expect(home).toContain('Favorites')
    expect(home.match(/data-fav/g)).toHaveLength(DEFAULT_FAVORITES.length)
    expect(link(at('/project/p1'), 'Projects')).toContain('aria-current="page"')
  })
})
