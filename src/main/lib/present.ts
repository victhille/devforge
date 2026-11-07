import { app, type BrowserWindow } from 'electron'

/**
 * End-to-end tests set DEVFORGE_TEST_OFFSCREEN=1: windows open off-screen and
 * never take the focus, so a test run does not get in the way of whoever
 * works on this PC. Ignored in the installed app.
 */
export const testOffscreen = !app.isPackaged && process.env.DEVFORGE_TEST_OFFSCREEN === '1'

/** Shows a window and gives it the focus (off-screen and unfocused under tests) */
export function present(w: BrowserWindow): void {
  if (testOffscreen) {
    w.setPosition(-32000, -32000)
    w.showInactive()
    return
  }
  w.show()
  w.focus()
}
