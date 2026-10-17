import { app, BrowserWindow, shell, nativeImage, Tray, Menu } from 'electron'
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

const isDev = !app.isPackaged

app.setName('DevForge')
if (process.platform === 'win32') app.setAppUserModelId('DevForge')

// ─── Single instance lock ─────────────────────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

let tray: Tray | null = null
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
    backgroundColor: '#0F1117',
    icon,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

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

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  registerIpcHandlers(win)

  if (isDev) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']!)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createTray(win)
}

app.whenReady().then(() => {
  // Apply saved startup settings
  const settings = loadSettings()
  app.setLoginItemSettings({
    openAtLogin: settings.startWithWindows,
    openAsHidden: settings.minimizeToTray
  })

  createWindow()

  // Warm the cache so the Environment page opens instantly
  detectEnvironment().catch(() => {})

  app.on('second-instance', () => {
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
      const win = windows[0]
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
app.on('before-quit', () => { processManager.stopAll(); stopMonitors(); stopProxy(); closeAllDbs(); closeAllTails(); stopWebhooks() })

app.on('window-all-closed', () => {
  sshService.disconnectAll()
  if (process.platform !== 'darwin') {
    tray?.destroy()
    tray = null
    app.quit()
  }
})
