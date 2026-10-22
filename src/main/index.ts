import { app, BrowserWindow, dialog, nativeImage, Tray, Menu } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { sshService } from './services/ssh/sshService'
import { loadSettings } from './services/settings/settingsService'
import { detectEnvironment } from './services/system/environmentDetector'
import { processManager } from './services/stacks/processManager'
import { stopMonitors } from './services/monitor/urlMonitor'
import { stopProxy } from './services/domains/domainProxy'
import { closeAllDbs } from './services/database/dbClient'
import { closeAllTails } from './services/logs/logTail'
import { stopWebhooks } from './services/webhooks/webhookServer'
import { applyLoginItem, startedHidden } from './lib/loginItem'
import { guardNavigation } from './lib/windowGuards'
import { disposeWidget, initWidget } from './widget'
import { initLog, log } from './lib/log'
import { migrateData } from './services/storage/migrations'
import { initUpdater, stopUpdater } from './services/updates/updater'
import { stopWatch } from './services/monitor/vpsWatch'
import { stopHistory } from './services/monitor/history'
import { closeAllForwards } from './services/ssh/localForward'

const isDev = !app.isPackaged

app.setName('DevForge')
if (process.platform === 'win32') app.setAppUserModelId('DevForge')

// ─── Single instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let forceQuit = false

function getIconPath(): string {
  return isDev
    ? join(app.getAppPath(), 'src/renderer/src/assets/icon.png')
    : join(process.resourcesPath, 'icon.png')
}

function buildTrayMenu(win: BrowserWindow): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: win.isVisible() ? 'Masquer DevForge' : 'Afficher DevForge',
      click: () => {
        if (win.isVisible()) { win.hide() } else { win.show(); win.focus() }
        tray?.setContextMenu(buildTrayMenu(win))
      }
    },
    { type: 'separator' },
    {
      label: 'Quitter',
      click: () => { forceQuit = true; app.quit() }
    }
  ])
}

function createTray(win: BrowserWindow): void {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('DevForge')
  tray.setContextMenu(buildTrayMenu(win))

  tray.on('click', () => {
    if (win.isVisible()) { win.hide() } else { win.show(); win.focus() }
    tray?.setContextMenu(buildTrayMenu(win))
  })
}

function createWindow(): void {
  const icon = nativeImage.createFromPath(getIconPath()).resize({ width: 256, height: 256 })

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0D0F13',
    icon,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => { if (!startedHidden) win.show() })
  win.webContents.on('render-process-gone', (_e, details) => log('error', 'renderer', `process gone: ${details.reason} (${details.exitCode})`))

  // Minimize to tray instead of closing
  win.on('close', (e) => {
    if (forceQuit) return
    const settings = loadSettings()
    if (settings.minimizeToTray) {
      e.preventDefault()
      win.hide()
      tray?.setContextMenu(buildTrayMenu(win))
    }
  })

  // Links open in the browser (http(s) only), the window never navigates away
  guardNavigation(win)
  mainWindow = win

  registerIpcHandlers(win)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createTray(win)
  initWidget(win)
}

// Crashes land in the local log (Settings → About → Copy report)
process.on('uncaughtException', err => log('error', 'main', err))
process.on('unhandledRejection', reason => log('error', 'main', reason instanceof Error ? reason : String(reason)))

/** Brings saved data to the current format before anything reads it */
function prepareData(): void {
  const dataDir = app.getPath('userData')
  initLog(join(dataDir, 'logs'))
  log('info', 'app', `DevForge ${app.getVersion()} started`)
  try {
    const r = migrateData(dataDir)
    if (r.status === 'migrated') log('info', 'storage', `data v${r.from} → v${r.to}: ${r.applied.join(', ')} (backup: ${r.backup})`)
    if (r.status === 'newer') {
      log('warn', 'storage', `data written by a newer DevForge (format v${r.version})`)
      dialog.showMessageBoxSync({
        type: 'warning',
        title: 'DevForge',
        message: 'Your data was saved by a newer version of DevForge.',
        detail: 'This version may not read all of it. Install the latest DevForge to avoid losing settings.'
      })
    }
  } catch (err) {
    log('error', 'storage', err instanceof Error ? err : String(err))
    dialog.showMessageBoxSync({
      type: 'error',
      title: 'DevForge',
      message: 'Updating your saved data failed.',
      detail: `A backup was made in ${join(dataDir, 'backups')}. Details are in ${join(dataDir, 'logs')}.`
    })
  }
}

app.whenReady().then(() => {
  prepareData()

  // Apply saved startup settings
  const settings = loadSettings()
  applyLoginItem(settings)

  createWindow()
  if (mainWindow) initUpdater(mainWindow, settings.updateChannel === 'beta')

  // Warm the cache so the Environment page opens instantly
  detectEnvironment().catch(() => {})

  app.on('second-instance', () => {
    // The main window, never the desktop widget
    const win = mainWindow
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Never leave dev servers running after DevForge quits
app.on('before-quit', () => { disposeWidget(); processManager.stopAll(); stopMonitors(); stopProxy(); closeAllDbs(); closeAllTails(); stopWebhooks(); stopUpdater(); stopWatch(); stopHistory(); closeAllForwards() })

app.on('window-all-closed', () => {
  sshService.disconnectAll()
  if (process.platform !== 'darwin') {
    tray?.destroy()
    tray = null
    app.quit()
  }
})
