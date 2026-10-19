import { app, ipcMain, shell } from 'electron'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { loadSettings, saveSettings } from '../services/settings/settingsService'
import { applyLoginItem } from '../lib/loginItem'
import { log } from '../lib/log'
import { checkForUpdates, getUpdateStatus, installUpdate, setUpdateChannel } from '../services/updates/updater'
import { DATA_ENTRIES, backupData, parseBackupName, readSchemaVersion, restoreData } from '../services/storage/migrations'
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
    saveSettings(settings)
    applyLoginItem(settings)
    setUpdateChannel(settings.updateChannel === 'beta')
  })

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
  ipcMain.handle('data:open-dir', () => shell.openPath(app.getPath('userData')))
  ipcMain.handle('data:open-log', () => shell.openPath(join(app.getPath('userData'), 'logs')))
  ipcMain.handle('data:clear-history', () => clearHistory())
}
