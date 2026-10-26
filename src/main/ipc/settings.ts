import { BrowserWindow, app, dialog, ipcMain, session, shell } from 'electron'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { join } from 'path'
import { loadSettings, saveSettings, setFavorites, setHomeWidgets } from '../services/settings/settingsService'
import { applyLoginItem } from '../lib/loginItem'
import { applyLauncher } from '../launcher'
import { log } from '../lib/log'
import { checkForUpdates, getUpdateStatus, installUpdate, setUpdateChannel } from '../services/updates/updater'
import { DATA_ENTRIES, backupData, parseBackupName, readSchemaVersion, restoreData } from '../services/storage/migrations'
import { exportConfig, importConfig, wipeData } from '../services/storage/profile'

/** End-to-end tests: a file path in place of the dialog (never in the installed app) */
const testPath = (name: string) => (!app.isPackaged && process.env[name]) || undefined

/** After the data changed under the app: start again from the files (skips before-quit, which could write over them) */
function restartApp(): void {
  if (!app.isPackaged && process.env.DEVFORGE_TEST_NO_RELAUNCH) {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.reload()
    return
  }
  app.relaunch()
  app.exit(0)
}
import { clearHistory } from '../services/monitor/history'
import type { AppSettings, DataInfo } from '@shared/types'

/** Size of a file or folder, in bytes */
function sizeOf(path: string): number {
  try {
    const st = statSync(path)
    if (!st.isDirectory()) return st.size
    return readdirSync(path).reduce((n, name) => n + sizeOf(join(path, name)), 0)
  } catch { return 0 }
}

function dataInfo(): DataInfo {
  const dir = app.getPath('userData')
  const backupsDir = join(dir, 'backups')
  const backups = (existsSync(backupsDir) ? readdirSync(backupsDir) : [])
    .map(name => ({ name, parsed: parseBackupName(name) }))
    .filter((b): b is { name: string; parsed: NonNullable<ReturnType<typeof parseBackupName>> } => !!b.parsed)
    .map(({ name, parsed }) => ({
      name,
      // 2026-10-19T09-12-03-120Z → ISO
      at: parsed.stamp.replace(/T(\d\d)-(\d\d)-(\d\d)-(\d+)Z$/, 'T$1:$2:$3.$4Z'),
      reason: parsed.reason,
      version: parsed.version
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
  return {
    dir,
    size: [...DATA_ENTRIES, 'logs'].reduce((n, e) => n + sizeOf(join(dir, e)), 0),
    schemaVersion: readSchemaVersion(dir),
    backups
  }
}

export function registerSettingsHandlers(): void {
  ipcMain.handle('get-settings', async () => loadSettings())

  ipcMain.handle('save-settings', async (_event, settings: AppSettings) => {
    const before = loadSettings()
    saveSettings(settings)
    applyLoginItem(settings)
    if (before.launcherEnabled !== settings.launcherEnabled || before.launcherShortcut !== settings.launcherShortcut) applyLauncher(loadSettings())
    setUpdateChannel(settings.updateChannel === 'beta')
  })

  ipcMain.handle('settings:favorites', (_event, paths: unknown) => setFavorites(paths))
  ipcMain.handle('settings:home-widgets', (_event, widgets: unknown) => setHomeWidgets(widgets))

  // ─── Updates ─────────────────────────────────────────────────────────────────
  ipcMain.handle('update:status', () => getUpdateStatus())
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:install', () => installUpdate())

  // ─── Data ────────────────────────────────────────────────────────────────────
  ipcMain.handle('data:info', () => dataInfo())
  ipcMain.handle('data:backup', () => {
    const dir = app.getPath('userData')
    backupData(dir, readSchemaVersion(dir), new Date(), 'manual')
    return dataInfo()
  })
  ipcMain.handle('data:restore', (_e, name: unknown) => {
    if (typeof name !== 'string') throw new Error('Unknown backup')
    const safety = restoreData(app.getPath('userData'), name)
    log('info', 'data', `Restored ${name} (previous data kept in ${safety})`)
    // Skips before-quit: nothing in memory may write over the restored files
    app.relaunch()
    app.exit(0)
  })
  // v3.0 lot 4: start over, or take one's setup elsewhere
  ipcMain.handle('data:wipe', async () => {
    const gone = wipeData(app.getPath('userData'))
    // The page's own memory too: snippets, panels, last version seen
    await session.defaultSession.clearStorageData({ storages: ['localstorage', 'indexdb', 'cookies'] })
    log('info', 'data', `Wiped ${gone.length} entries`)
    restartApp()
  })
  ipcMain.handle('data:export', async () => {
    const bundle = exportConfig(app.getPath('userData'), app.getVersion())
    const name = `devforge-config-${new Date().toISOString().slice(0, 10)}.json`
    const target = testPath('DEVFORGE_TEST_EXPORT_PATH')
      ?? (await dialog.showSaveDialog({ defaultPath: join(app.getPath('documents'), name), filters: [{ name: 'DevForge', extensions: ['json'] }] })).filePath
    if (!target) return null
    writeFileSync(target, JSON.stringify(bundle, null, 2))
    return target
  })
  ipcMain.handle('data:import', async () => {
    const source = testPath('DEVFORGE_TEST_IMPORT_PATH')
      ?? (await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'DevForge', extensions: ['json'] }] })).filePaths[0]
    if (!source) return null
    const names = importConfig(app.getPath('userData'), readFileSync(source, 'utf-8'))
    log('info', 'data', `Imported ${names.length} files`)
    restartApp()
    return names
  })
  ipcMain.handle('data:open-dir', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('data:open-log', () => shell.openPath(join(app.getPath('userData'), 'logs')))
  ipcMain.handle('data:clear-history', () => clearHistory())
}
