import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import type { AppSettings, LauncherToMain } from '@shared/types'
import { guardNavigation } from './lib/windowGuards'
import { present, testOffscreen } from './lib/present'

/**
 * The global launcher: a floating search box over any application, opened by
 * a system shortcut (Ctrl+Alt+Space by default). Its window is created once
 * and kept hidden, so showing it is instant. What it opens or runs in
 * DevForge goes to the main window.
 */

export const DEFAULT_LAUNCHER_SHORTCUT = 'CommandOrControl+Alt+Space'
const SIZE = { width: 680, height: 460 }

let win: BrowserWindow | null = null
let mainWin: BrowserWindow | null = null
let shortcut: string | null = null
/** The shortcut was asked for but another application owns it */
let shortcutTaken = false

const launcherWindow = () => (win && !win.isDestroyed() ? win : null)

function create(): void {
  if (launcherWindow()) return
  const w = new BrowserWindow({
    ...SIZE,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    title: 'DevForge',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win = w
  w.setAlwaysOnTop(true, 'pop-up-menu')
  guardNavigation(w)
  // Clicking elsewhere closes it, like Windows' own search
  w.on('blur', () => { if (!testOffscreen) hide() })
  w.on('closed', () => { if (win === w) win = null })
  const devUrl = !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
  if (devUrl) w.loadURL(`${devUrl}/launcher.html`)
  else w.loadFile(join(__dirname, '../renderer/launcher.html'))
}

/** Centered on the display under the mouse, a third from the top */
function place(w: BrowserWindow): void {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  w.setBounds({ x: Math.round(wa.x + (wa.width - SIZE.width) / 2), y: Math.round(wa.y + wa.height / 5), ...SIZE })
}

export function showLauncher(): void {
  const w = launcherWindow()
  if (!w) return
  place(w)
  w.webContents.send('launcher:shown')
  present(w)
}

export function hide(): void {
  const w = launcherWindow()
  if (w?.isVisible()) w.hide()
}

function toggle(): void {
  if (launcherWindow()?.isVisible()) hide()
  else showLauncher()
}

function unregister(): void {
  if (shortcut) globalShortcut.unregister(shortcut)
  shortcut = null
}

/** Applies the settings: window kept ready and shortcut taken, or both gone */
export function applyLauncher(settings: Pick<AppSettings, 'launcherEnabled' | 'launcherShortcut'>): void {
  unregister()
  shortcutTaken = false
  if (!settings.launcherEnabled) { launcherWindow()?.destroy(); win = null; return }
  create()
  const accel = settings.launcherShortcut || DEFAULT_LAUNCHER_SHORTCUT
  try {
    if (globalShortcut.register(accel, toggle)) shortcut = accel
    else shortcutTaken = true
  } catch { shortcutTaken = true }
}

export const launcherState = () => ({ shortcut: shortcut?.replace('CommandOrControl', 'Ctrl') ?? null, taken: shortcutTaken })

/** Something to do in the main window: it comes to the front first */
export function toMain(message: LauncherToMain): void {
  hide()
  const m = mainWin
  if (!m || m.isDestroyed()) return
  if (m.isMinimized()) m.restore()
  present(m)
  m.webContents.send('launcher:to-main', message)
}

export function initLauncher(main: BrowserWindow, settings: AppSettings): void {
  mainWin = main
  main.on('closed', () => { mainWin = null; disposeLauncher() })
  applyLauncher(settings)
}

export function disposeLauncher(): void {
  unregister()
  launcherWindow()?.destroy()
  win = null
}
