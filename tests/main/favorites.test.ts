import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { cleanFavorites, DEFAULT_FAVORITES, MAX_FAVORITES } from '../../src/shared/lib/favorites'
import { loadSettings, saveSettings, setFavorites } from '../../src/main/services/settings/settingsService'
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
})
