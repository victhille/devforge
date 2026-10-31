import { join } from 'path'
import { pathToFileURL } from 'url'
import { session, shell, type BrowserWindow, type Session } from 'electron'

/** The app's own pages: the built renderer folder, or the dev server */
function ownPage(url: string): boolean {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl && url.startsWith(devUrl)) return true
  // Built next to this file: out/main → out/renderer (inside app.asar once packaged)
  const base = pathToFileURL(join(__dirname, '..', 'renderer')).href + '/'
  return url.startsWith(base) && !url.slice(base.length).includes('..')
}

/**
 * Same rules for every app window: http(s) links open in the browser, the page
 * never navigates away from the app's own pages (another local HTML file
 * would get the full `window.devforge` bridge), no <webview>.
 */
export function guardNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => { if (!ownPage(url)) e.preventDefault() })
  win.webContents.on('will-redirect', (e, url) => { if (!ownPage(url)) e.preventDefault() })
  win.webContents.on('will-attach-webview', e => e.preventDefault())
}

/**
 * What a page may ask for: the microphone (dictation), writing to the
 * clipboard, notifications. Everything else (camera, position, screen,
 * USB, MIDI…), which Electron grants by default, is refused.
 */
const ALLOWED = new Set(['clipboard-sanitized-write', 'notifications'])

function allowed(permission: string, origin: string, mediaTypes?: string[]): boolean {
  // The app's pages only (a check may give just "file:///" as the origin)
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!origin.startsWith('file://') && !(devUrl && origin.startsWith(new URL(devUrl).origin))) return false
  if (ALLOWED.has(permission)) return true
  // getUserMedia: audio only
  if (permission === 'media') return !!mediaTypes?.length && mediaTypes.every(t => t === 'audio')
  return false
}

export function guardPermissions(s: Session = session.defaultSession): void {
  s.setPermissionRequestHandler((wc, permission, done, details) => {
    const media = 'mediaTypes' in details ? (details.mediaTypes as string[] | undefined) : undefined
    done(allowed(permission, details.requestingUrl || wc.getURL(), media))
  })
  s.setPermissionCheckHandler((_wc, permission, origin, details) => {
    const media = details && 'mediaType' in details && details.mediaType ? [details.mediaType as string] : undefined
    return allowed(permission, origin || '', permission === 'media' ? media ?? ['audio'] : undefined)
  })
}
