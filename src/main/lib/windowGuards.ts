import { shell, type BrowserWindow } from 'electron'

/** Same rules for every app window: http(s) links open in the browser, the page never navigates away */
export function guardNavigation(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  // Dev server reloads are fine
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!(devUrl && url.startsWith(devUrl)) && !url.startsWith('file://')) e.preventDefault()
  })
}
