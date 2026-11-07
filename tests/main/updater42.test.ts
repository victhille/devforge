import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { app } from 'electron'

/** v4.2 lot 4: updates from the GitHub releases — the states shown in the title bar (electron-updater faked) */

const fake = vi.hoisted(() => {
  const handlers = new Map<string, (arg: never) => void>()
  return {
    handlers,
    newest: { prerelease: false },
    token: null as string | null,
    available: false,
    fail: false,
    feed: null as Record<string, unknown> | null,
    installs: [] as boolean[][],
    autoUpdater: {
      allowPrerelease: false, allowDowngrade: true, autoDownload: false, autoInstallOnAppQuit: false, logger: null as unknown,
      setFeedURL(o: Record<string, unknown>) { fake.feed = o },
      async checkForUpdates() { if (fake.fail) throw new Error('404'); return { isUpdateAvailable: fake.available } },
      quitAndInstall(...a: boolean[]) { fake.installs.push(a) },
      on(event: string, cb: (arg: never) => void) { handlers.set(event, cb) }
    }
  }
})
vi.mock('electron-updater', () => ({ autoUpdater: fake.autoUpdater }))
vi.mock('../../src/main/services/github/githubService', () => ({
  githubToken: async () => fake.token,
  newestIsPrerelease: async () => fake.newest.prerelease
}))

const { checkForUpdates, getUpdateStatus, initUpdater, installUpdate, setUpdateChannel, stopUpdater } = await import('../../src/main/services/updates/updater')

const sent: unknown[] = []
const win = { isDestroyed: () => false, webContents: { send: (_c: string, s: unknown) => sent.push(s) } } as never
const packaged = (v: boolean) => { (app as { isPackaged: boolean }).isPackaged = v }

beforeEach(() => { fake.available = false; fake.fail = false; fake.newest.prerelease = false })
afterAll(() => { packaged(false); stopUpdater() })

describe('in development', () => {
  it('never looks for updates; the tests may set a status by hand', async () => {
    expect(await checkForUpdates()).toEqual({ state: 'unavailable', reason: 'dev' })
    process.env.DEVFORGE_TEST_UPDATE = JSON.stringify({ state: 'ready', version: '9.9.9' })
    initUpdater(win, false)
    expect(getUpdateStatus()).toEqual({ state: 'ready', version: '9.9.9' })
    delete process.env.DEVFORGE_TEST_UPDATE
    initUpdater(win, false)
    expect(getUpdateStatus()).toEqual({ state: 'unavailable', reason: 'dev' })
  })
})

describe('in the installed app', () => {
  it('reads the public releases without a token, and says when it is up to date', async () => {
    packaged(true)
    vi.useFakeTimers()
    initUpdater(win, false)
    vi.useRealTimers()
    expect(fake.autoUpdater).toMatchObject({ autoDownload: true, autoInstallOnAppQuit: true, allowDowngrade: false })
    const s = await checkForUpdates()
    expect(s).toMatchObject({ state: 'up-to-date' })
    expect(fake.feed).toEqual({ provider: 'github', owner: 'example', repo: 'devforge', private: false })
    // The window heard each step
    expect(sent).toEqual(expect.arrayContaining([{ state: 'checking' }, expect.objectContaining({ state: 'up-to-date' })]))
  })

  it('takes pre-releases on the beta channel only while the newest release is one', async () => {
    setUpdateChannel(true)
    fake.newest.prerelease = false
    await checkForUpdates()
    expect(fake.autoUpdater.allowPrerelease).toBe(false)
    fake.newest.prerelease = true
    await checkForUpdates()
    expect(fake.autoUpdater.allowPrerelease).toBe(true)
    setUpdateChannel(false)
    await checkForUpdates()
    expect(fake.autoUpdater.allowPrerelease).toBe(false)
  })

  it('a feed it cannot read leaves it unavailable, quietly', async () => {
    fake.fail = true
    expect(await checkForUpdates()).toEqual({ state: 'unavailable', reason: 'feed' })
  })

  it('downloads, shows the progress, then installs on demand only once ready', async () => {
    installUpdate()
    expect(fake.installs).toEqual([])
    fake.handlers.get('update-available')!({ version: '4.2.0' } as never)
    expect(getUpdateStatus()).toEqual({ state: 'downloading', version: '4.2.0', percent: 0 })
    fake.handlers.get('download-progress')!({ percent: 41.6 } as never)
    expect(getUpdateStatus()).toMatchObject({ percent: 42 })
    // No new check while it downloads
    expect(await checkForUpdates()).toMatchObject({ state: 'downloading' })
    fake.handlers.get('update-downloaded')!({ version: '4.2.0' } as never)
    expect(getUpdateStatus()).toEqual({ state: 'ready', version: '4.2.0' })
    // An error after the download keeps the update ready
    fake.handlers.get('error')!(new Error('late') as never)
    expect(getUpdateStatus().state).toBe('ready')
    // Not silent: the installer shows its progress, then DevForge starts again
    installUpdate()
    expect(fake.installs).toEqual([[false, true]])
  })
})
