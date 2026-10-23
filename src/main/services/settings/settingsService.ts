import { existsSync, readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { AppSettings } from '@shared/types'
import { writeJsonFile } from '../../lib/jsonFile'
import { DEFAULT_FAVORITES, cleanFavorites } from '@shared/lib/favorites'
import { DEFAULT_WIDGETS, cleanWidgets } from '@shared/lib/homeWidgets'
import type { HomeWidget } from '@shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  defaultProjectsDir: '',
  defaultPackageManager: 'npm',
  defaultIDE: 'vscode',
  theme: 'dark',
  defaultTerminal: 'powershell',
  language: 'en',
  startWithWindows: false,
  minimizeToTray: false,
  updateChannel: 'stable',
  motion: 'system',
  density: 'comfortable',
  showWhatsNew: true,
  dictationModel: 'base',
  onboarded: false,
  favorites: DEFAULT_FAVORITES,
  homeWidgets: DEFAULT_WIDGETS
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): AppSettings {
  const path = getSettingsPath()
  if (!existsSync(path)) {
    // Default dir: user's home / Development
    return {
      ...DEFAULT_SETTINGS,
      defaultProjectsDir: join(app.getPath('home'), 'Development')
    }
  }
  try {
    // A settings file from before the first-launch tour: that user is not new
    const s = { ...DEFAULT_SETTINGS, onboarded: true, ...JSON.parse(readFileSync(path, 'utf-8')) } as AppSettings
    return { ...s, favorites: cleanFavorites(s.favorites), homeWidgets: cleanWidgets(s.homeWidgets) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

/** Favorites and Home widgets keep the value on disk: a page holding an older copy of the settings cannot undo them */
export function saveSettings(settings: AppSettings): void {
  const path = getSettingsPath()
  mkdirSync(dirname(path), { recursive: true })
  const disk = loadSettings()
  writeJsonFile(path, { ...settings, favorites: disk.favorites, homeWidgets: disk.homeWidgets })
}

export function setHomeWidgets(widgets: unknown): HomeWidget[] {
  const path = getSettingsPath()
  mkdirSync(dirname(path), { recursive: true })
  const homeWidgets = cleanWidgets(widgets)
  writeJsonFile(path, { ...loadSettings(), homeWidgets })
  return homeWidgets
}

export function setFavorites(paths: unknown): string[] {
  const path = getSettingsPath()
  mkdirSync(dirname(path), { recursive: true })
  const favorites = cleanFavorites(paths)
  writeJsonFile(path, { ...loadSettings(), favorites })
  return favorites
}
