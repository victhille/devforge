import { app, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateStatus } from '@shared/types'
import { log } from '../../lib/log'
import { githubToken, newestIsPrerelease } from '../github/githubService'

/**
 * Updates from the GitHub releases (electron-updater): checked at startup and
 * every 6 hours, downloaded in the background, installed on restart. The beta
 * channel also takes pre-releases (2.0.0-beta.1…).
 * Only in the installed app; a release feed that cannot be read (private
 * repository, offline) leaves the status "unavailable" without bothering the user.
 */
const EVERY = 6 * 60 * 60 * 1000
/** Where the releases are published (package.json › build.publish); the repository is private */
const OWNER = 'victhille'
const REPO = 'devforge'
let beta = false

let status: UpdateStatus = { state: 'idle' }
let win: BrowserWindow | null = null
let timer: ReturnType<typeof setInterval> | null = null

function set(next: UpdateStatus): void {
  status = next
  if (win && !win.isDestroyed()) win.webContents.send('update:status', status)
}

export const getUpdateStatus = (): UpdateStatus => status

export function setUpdateChannel(wantBeta: boolean): void {
  beta = wantBeta
  autoUpdater.allowPrerelease = wantBeta
  // Going back to stable never installs an older version by itself
  autoUpdater.allowDowngrade = false
}

export async function checkForUpdates(): Promise<UpdateStatus> {
  if (!app.isPackaged) { set({ state: 'unavailable', reason: 'dev' }); return status }
  if (status.state === 'downloading' || status.state === 'ready') return status
  set({ state: 'checking' })
  // A private repository: the releases are read with GitHub CLI's token (or the one saved in DevForge)
  const tok = await githubToken()
  if (!tok) { set({ state: 'unavailable', reason: 'auth' }); return status }
  autoUpdater.setFeedURL({ provider: 'github', owner: OWNER, repo: REPO, private: true, token: tok })
  try {
    // electron-updater's beta channel takes the first pre-release of the list, even when a newer final
    // version exists: pre-releases are allowed only while the newest release is one
    autoUpdater.allowPrerelease = beta && await newestIsPrerelease(OWNER, REPO, tok).catch(() => true)
    const r = await autoUpdater.checkForUpdates()
    if (!r?.isUpdateAvailable) set({ state: 'up-to-date', checkedAt: Date.now() })
  } catch (err) {
    log('warn', 'updates', err instanceof Error ? err.message : String(err))
    set({ state: 'unavailable', reason: 'feed' })
  }
  return status
}

export function installUpdate(): void {
  if (status.state === 'ready') autoUpdater.quitAndInstall()
}

export function initUpdater(window: BrowserWindow, beta: boolean): void {
  win = window
  if (!app.isPackaged) {
    // Tests of the title-bar button set a status by hand (never in the installed app)
    const fake = process.env.DEVFORGE_TEST_UPDATE
    status = fake ? (JSON.parse(fake) as UpdateStatus) : { state: 'unavailable', reason: 'dev' }
    return
  }
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (m: unknown) => log('info', 'updates', m),
    warn: (m: unknown) => log('warn', 'updates', m),
    error: (m: unknown) => log('warn', 'updates', m),
    debug: () => {}
  }
  setUpdateChannel(beta)
  autoUpdater.on('update-available', info => set({ state: 'downloading', version: info.version, percent: 0 }))
  autoUpdater.on('download-progress', p => { if (status.state === 'downloading') set({ ...status, percent: Math.round(p.percent) }) })
  autoUpdater.on('update-downloaded', info => set({ state: 'ready', version: info.version }))
  autoUpdater.on('error', err => {
    log('warn', 'updates', err)
    if (status.state !== 'ready') set({ state: 'unavailable', reason: 'feed' })
  })
  // A little after startup, so the first screen is not slowed down
  setTimeout(() => { checkForUpdates() }, 15_000)
  timer = setInterval(() => { checkForUpdates() }, EVERY)
}

export function stopUpdater(): void {
  if (timer) clearInterval(timer)
  timer = null
}
