import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'
import type { AppSettings } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  defaultProjectsDir: '',
  defaultPackageManager: 'npm',
  defaultIDE: 'vscode',
  theme: 'dark',
  defaultTerminal: 'powershell',
  language: 'en',
  startWithWindows: false,
  minimizeToTray: false
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
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(path, 'utf-8')) }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: AppSettings): void {
  const path = getSettingsPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}
