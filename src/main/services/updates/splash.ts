import { app, BrowserWindow } from 'electron'

/**
 * After an update the installer starts DevForge with --updated: a small window says so (as Discord does) while
 * the main window loads, so the gap between the installer and the app never looks empty. A static page in a
 * data: URL, no script, no preload: nothing in it can reach the app.
 */
export const startedAfterUpdate = process.argv.includes('--updated')

const MIN_MS = 1200

/** The splash page: static, no script (tested) */
export function splashPage(version: string, fr: boolean): string {
  const lines = fr ? ['Mise à jour installée', 'Ouverture de DevForge…'] : ['Update installed', 'Opening DevForge…']
  return `<!doctype html><html lang="${fr ? 'fr' : 'en'}"><head><meta charset="utf-8"><title>DevForge</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
html,body{margin:0;height:100%;background:#121110;color:#F2EEE9;font-family:'Segoe UI',system-ui,sans-serif;overflow:hidden;-webkit-user-select:none;-webkit-app-region:drag}
main{height:100%;box-sizing:border-box;border:1px solid #2E2A26;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
.logo{width:84px;height:84px;border-radius:22px;background:#FF7A33;display:grid;place-items:center;animation:bob 1.6s ease-in-out infinite}
h1{margin:0;font-size:22px}
p{margin:0;font-size:13px;color:#B5ADA4}
.bar{width:160px;height:4px;border-radius:99px;background:#2A2622;overflow:hidden}
.bar i{display:block;width:40%;height:100%;border-radius:99px;background:#FF7A33;animation:run 1.1s ease-in-out infinite}
small{font:11px Consolas,monospace;color:#9E968D}
@keyframes bob{50%{transform:translateY(-6px)}}
@keyframes run{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@media (prefers-reduced-motion:reduce){.logo,.bar i{animation:none}}
</style></head><body><main>
<div class="logo" aria-hidden="true"><svg width="48" height="48" viewBox="0 0 24 24"><path d="M3 7h17l-4 4H6zM9 11h6v4H9zM6 15h12v3H6z" fill="#1A0A02"/></svg></div>
<h1>DevForge</h1><p>${lines[0]}</p><div class="bar" aria-hidden="true"><i></i></div><p>${lines[1]}</p><small>v${version}</small>
</main></body></html>`
}

/** Shown at once; `closeWith` hides it when the main window is ready, never before MIN_MS (no flash) */
export function showUpdateSplash(fr: boolean): { closeWith: (main: BrowserWindow) => void } {
  const shownAt = Date.now()
  const splash = new BrowserWindow({
    width: 320,
    height: 400,
    frame: false,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#121110',
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
  })
  splash.once('ready-to-show', () => splash.show())
  splash.webContents.on('will-navigate', e => e.preventDefault())
  splash.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashPage(app.getVersion(), fr))}`).catch(() => {})
  return {
    closeWith: main => {
      const close = () => setTimeout(() => !splash.isDestroyed() && splash.close(), Math.max(0, MIN_MS - (Date.now() - shownAt)))
      if (main.isVisible()) close()
      else main.once('show', close)
      // A main window that never shows (started hidden) must not leave the splash behind
      setTimeout(() => !splash.isDestroyed() && splash.close(), 15_000)
    }
  }
}
