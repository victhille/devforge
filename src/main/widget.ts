import { app, BrowserWindow, globalShortcut, screen } from 'electron'
import { join } from 'path'
import { getConfig } from './services/assistant/assistantStorage'
import { guardNavigation } from './lib/windowGuards'

/**
 * Forgy's desktop widget: a small frameless, transparent, always-on-top
 * window pinned bottom-right of the primary display's work area (just above
 * the taskbar clock). Collapsed it is a bubble that never takes focus; open,
 * it takes focus so the user can type. The renderer sizes it to its content.
 */

/** Global shortcuts, first free one wins (another app may own Ctrl+Alt+Space) */
const SHORTCUTS = ['CommandOrControl+Alt+Space', 'CommandOrControl+Alt+J']
/** Gap to the work area edges */
const MARGIN = 8
const COLLAPSED = { width: 112, height: 112 }

let widget: BrowserWindow | null = null
let mainWin: BrowserWindow | null = null
let size = { ...COLLAPSED }
let shortcut: string | null = null

export const widgetWindow = (): BrowserWindow | null => (widget && !widget.isDestroyed() ? widget : null)

/** Bottom-right of the primary work area; follows taskbar moves and display changes */
function place(): void {
  const w = widgetWindow()
  if (!w) return
  const wa = screen.getPrimaryDisplay().workArea
  const width = Math.min(size.width, wa.width - 2 * MARGIN)
  const height = Math.min(size.height, wa.height - 2 * MARGIN)
  w.setBounds({ x: wa.x + wa.width - width - MARGIN, y: wa.y + wa.height - height - MARGIN, width, height })
}

function create(): void {
  if (widgetWindow()) return
  const w = new BrowserWindow({
    ...COLLAPSED,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // Collapsed: clicks work, focus stays where the user is typing
    focusable: false,
    show: false,
    title: 'Forgy',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  widget = w
  size = { ...COLLAPSED }
  w.setAlwaysOnTop(true, 'floating')
  guardNavigation(w)
  w.once('ready-to-show', () => { place(); w.showInactive() })
  w.on('closed', () => { if (widget === w) widget = null })

  const devUrl = !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
  if (devUrl) w.loadURL(`${devUrl}/widget.html`)
  else w.loadFile(join(__dirname, '../renderer/widget.html'))

  // All taken: the bubble still opens on click
  if (!shortcut) shortcut = SHORTCUTS.find(k => { try { return globalShortcut.register(k, toggle) } catch { return false } }) ?? null
}

function destroy(): void {
  if (shortcut) globalShortcut.unregister(shortcut)
  shortcut = null
  widgetWindow()?.destroy()
  widget = null
}

function toggle(): void {
  widgetWindow()?.webContents.send('widget:toggle')
}

/** The shortcut that opens the widget, as shown to the user (null: none free, or widget off) */
export const widgetShortcut = (): string | null => shortcut?.replace('CommandOrControl', 'Ctrl') ?? null

export function setWidgetEnabled(on: boolean): void {
  if (on) create()
  else destroy()
}

/** Content size reported by the widget page */
export function resizeWidget(width: number, height: number): void {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return
  const next = { width: Math.round(Math.min(Math.max(width, 60), 460)), height: Math.round(Math.min(Math.max(height, 60), 900)) }
  if (next.width === size.width && next.height === size.height) return
  size = next
  place()
}

export function setWidgetOpen(open: boolean): void {
  const w = widgetWindow()
  if (!w) return
  w.setFocusable(open)
  // Windows can drop the topmost flag when the focusable style changes
  w.setAlwaysOnTop(true, 'floating')
  if (open) { w.show(); w.focus() }
  else if (w.isFocused()) w.blur()
}

/** Brings the main window to the front, on a conversation of the widget */
export function openInApp(conversationId: string | null): void {
  if (!mainWin || mainWin.isDestroyed()) return
  if (mainWin.isMinimized()) mainWin.restore()
  mainWin.show()
  mainWin.focus()
  if (conversationId) mainWin.webContents.send('assistant:open-conversation', conversationId)
}

/** Called once with the main window: the widget lives and dies with it */
export function initWidget(main: BrowserWindow): void {
  mainWin = main
  main.on('closed', () => { mainWin = null; destroy() })
  screen.on('display-metrics-changed', place)
  screen.on('display-added', place)
  screen.on('display-removed', place)
  if (getConfig().desktopWidget) create()
}

export function disposeWidget(): void {
  destroy()
}
