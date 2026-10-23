import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { cleanFavorites, DEFAULT_FAVORITES, MAX_FAVORITES } from '../../src/shared/lib/favorites'
import { loadSettings, saveSettings, setFavorites, setHomeWidgets } from '../../src/main/services/settings/settingsService'
import { cleanWidgets, DEFAULT_WIDGETS } from '../../src/shared/lib/homeWidgets'
import { userData } from '../helpers'

describe('menu favorites', () => {
  it('keeps page paths only, once, and caps the list', () => {
    expect(cleanFavorites(undefined)).toEqual(DEFAULT_FAVORITES)
    expect(cleanFavorites(['/vpn', '/vpn', '/', 'https://x', 3, '/n8n'])).toEqual(['/vpn', '/n8n'])
    expect(cleanFavorites(Array.from({ length: 20 }, (_, i) => `/p${i}`))).toHaveLength(MAX_FAVORITES)
  })

  it('a page holding older settings cannot undo a pin', () => {
    writeFileSync(join(userData(), 'settings.json'), JSON.stringify({ language: 'fr' }))
    expect(loadSettings().favorites).toEqual(DEFAULT_FAVORITES)
    const stale = loadSettings()
    expect(setFavorites(['/vpn', '/projects'])).toEqual(['/vpn', '/projects'])
    // The Settings page saves the copy it read before the pin
    saveSettings({ ...stale, theme: 'light' })
    expect(loadSettings()).toMatchObject({ theme: 'light', favorites: ['/vpn', '/projects'] })
    expect(setFavorites([])).toEqual([])
    expect(loadSettings().favorites).toEqual([])
  })

  it('a beta build follows the beta channel until the user picks one', () => {
    // The test app's version is 0.0.0-test: a pre-release
    writeFileSync(join(userData(), 'settings.json'), JSON.stringify({ language: 'fr' }))
    expect(loadSettings().updateChannel).toBe('beta')
    writeFileSync(join(userData(), 'settings.json'), JSON.stringify({ language: 'fr', updateChannel: 'stable' }))
    expect(loadSettings().updateChannel).toBe('stable')
  })

  it('Home widgets: known ones only, once each, and kept from an older copy of the settings', () => {
    expect(cleanWidgets(undefined)).toEqual(DEFAULT_WIDGETS)
    expect(cleanWidgets([{ id: 'health', size: 'full' }, { id: 'health', size: 'half' }, { id: 'nope', size: 'half' }, { id: 'vpn', size: 'huge' }]))
      .toEqual([{ id: 'health', size: 'full' }, { id: 'vpn', size: 'half' }])
    writeFileSync(join(userData(), 'settings.json'), JSON.stringify({ language: 'fr' }))
    const stale = loadSettings()
    expect(stale.homeWidgets).toEqual(DEFAULT_WIDGETS)
    setHomeWidgets([{ id: 'backups', size: 'half' }])
    saveSettings({ ...stale, density: 'compact' })
    expect(loadSettings()).toMatchObject({ density: 'compact', homeWidgets: [{ id: 'backups', size: 'half' }] })
  })
})
