import { execFile, spawn } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { log } from '../../lib/log'

/**
 * While the installer replaces DevForge's files, DevForge itself cannot run. The update installs
 * silently, and this small window (Windows' own mshta, outside DevForge's folder) says what is going
 * on, in DevForge's colors, until the new version starts (it closes the window) or 2 minutes pass.
 * The page is fixed text: its only script places the window and closes it.
 */

const SECONDS = 120
const VERSION_RE = /^[0-9A-Za-z.+-]{1,40}$/

const stateFile = () => join(app.getPath('userData'), 'update-window.json')

/** The window's page (HTA): fixed words, the version checked, no data from elsewhere (tested) */
export function installPage(version: string, fr: boolean): string {
  const v = VERSION_RE.test(version) ? version : ''
  const [title, line, hint] = fr
    ? ['Mise à jour de DevForge', `Installation de la version ${v}…`, 'DevForge revient tout seul dans quelques secondes.']
    : ['Updating DevForge', `Installing version ${v}…`, 'DevForge comes back by itself in a few seconds.']
  return `<!doctype html>
<html lang="${fr ? 'fr' : 'en'}"><head>
<hta:application id="devforge" applicationname="DevForge" border="none" caption="no" innerborder="no" scroll="no" selection="no" contextmenu="no" showintaskbar="yes" singleinstance="yes" maximizebutton="no" minimizebutton="no" sysmenu="no">
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=10">
<title>DevForge</title>
<style>
html,body{margin:0;height:100%;overflow:hidden;background:#121110;color:#F2EEE9;font-family:'Segoe UI',sans-serif;cursor:default}
.box{position:absolute;top:0;left:0;right:0;bottom:0;border:1px solid #2E2A26;text-align:center;padding-top:72px}
.logo{width:84px;height:84px;margin:0 auto;border-radius:22px;background:#FF7A33;line-height:96px;animation:bob 1.6s ease-in-out infinite}
h1{margin:20px 0 6px;font-size:22px;font-weight:600}
p{margin:0 24px;font-size:13px;color:#B5ADA4}
.bar{width:160px;height:4px;margin:18px auto;border-radius:99px;background:#2A2622;overflow:hidden}
.bar i{display:block;width:40%;height:100%;border-radius:99px;background:#FF7A33;animation:run 1.1s ease-in-out infinite}
small{display:block;margin-top:14px;font:11px Consolas,monospace;color:#9E968D}
@keyframes bob{50%{transform:translateY(-6px)}}
@keyframes run{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
</style>
<script>
var W = 320, H = 400;
window.resizeTo(W, H);
window.moveTo((screen.availWidth - W) / 2, (screen.availHeight - H) / 2);
setTimeout(function () { window.close(); }, ${SECONDS * 1000});
</script>
</head><body><div class="box">
<div class="logo"><svg width="48" height="48" viewBox="0 0 24 24"><path d="M3 7h17l-4 4H6zM9 11h6v4H9zM6 15h12v3H6z" fill="#1A0A02"/></svg></div>
<h1>${title}</h1><p>${line}</p><div class="bar"><i></i></div><p>${hint}</p><small>DevForge ${v}</small>
</div></body></html>`
}

const system32 = (exe: string) => join(process.env.SystemRoot || 'C:\\Windows', 'System32', exe)

/** Opens the window just before DevForge quits for the installer; nothing happens where mshta is missing */
export function showInstallWindow(version: string, fr: boolean): void {
  // Only the installed app updates (and the tests never open it)
  if (process.platform !== 'win32' || !app.isPackaged) return
  try {
    const mshta = system32('mshta.exe')
    if (!existsSync(mshta)) return
    // A folder of its own, with a name nobody can guess, and a page written only if it is new
    const dir = mkdtempSync(join(app.getPath('temp'), 'devforge-update-'))
    const page = join(dir, 'devforge-update.hta')
    writeFileSync(page, installPage(version, fr), { encoding: 'utf-8', flag: 'wx' })
    const child = spawn(mshta, [page], { detached: true, stdio: 'ignore', windowsHide: false })
    child.on('error', () => {})
    if (child.pid) writeFileSync(stateFile(), JSON.stringify({ pid: child.pid, dir }))
    child.unref()
  } catch (err) {
    log('warn', 'updates', `Install window: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/** At startup: the new version is here, the window goes (and its files), without making the start wait */
export function closeInstallWindow(): void {
  if (process.platform !== 'win32' || !existsSync(stateFile())) return
  let state: { pid?: unknown; dir?: unknown } = {}
  try {
    state = JSON.parse(readFileSync(stateFile(), 'utf-8'))
  } catch {
    /* unreadable: only the file goes */
  }
  rmSync(stateFile(), { force: true })
  const pid = Number(state.pid)
  const dir = typeof state.dir === 'string' && /[\\/]devforge-update-[^\\/]+$/.test(state.dir) ? state.dir : null
  // Removed a little later: mshta may still hold the page for a moment
  const clean = () => dir && setTimeout(() => rmSync(dir, { recursive: true, force: true }), 3000)
  if (!Number.isInteger(pid) || pid <= 0) return void clean()
  // Still mshta's? (a pid is reused once its program ends)
  execFile(
    system32('tasklist.exe'),
    ['/FI', `PID eq ${pid}`, '/FI', 'IMAGENAME eq mshta.exe', '/FO', 'CSV', '/NH'],
    { windowsHide: true, timeout: 5000 },
    (err, out) => {
      if (!err && String(out).toLowerCase().includes('"mshta.exe"'))
        execFile(system32('taskkill.exe'), ['/PID', String(pid), '/F'], { windowsHide: true }, () => clean())
      else clean()
    }
  )
}
