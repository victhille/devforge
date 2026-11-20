import { existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { userData } from '../helpers'

const { closeInstallWindow, installPage } = await import('../../src/main/services/updates/installWindow')

/** The small window shown while the update installs silently (Windows' mshta) */
describe('install window', () => {
  it('is fixed text in DevForge colors, in the chosen language, that closes itself', () => {
    const fr = installPage('0.4.1', true)
    expect(fr).toContain('Mise à jour de DevForge')
    expect(fr).toContain('Installation de la version 0.4.1…')
    expect(fr).toContain('<hta:application')
    expect(fr).toContain('caption="no"')
    // It goes by itself after 2 minutes, whatever happens to the installer
    expect(fr).toContain('setTimeout(function () { window.close(); }, 120000)')
    expect(installPage('0.4.1', false)).toContain('Installing version 0.4.1…')
    // Nothing from elsewhere: no address, no file, no other script
    expect(fr).not.toMatch(/https?:|file:|src=|ActiveXObject|WScript/i)
    expect(fr.match(/<script/g)).toHaveLength(1)
  })

  it('takes only a real version number', () => {
    const page = installPage('1.0.0"><script>alert(1)</script>', true)
    expect(page).not.toContain('alert(1)')
    expect(page).toContain('Installation de la version …')
    expect(installPage('1.0.0-beta.1', true)).toContain('version 1.0.0-beta.1…')
  })

  it('at startup, forgets the window, and never kills a program that is not its mshta', async () => {
    // A pid that is not mshta's (this test itself): left alone, the state forgotten
    const stateFile = join(userData(), 'update-window.json')
    writeFileSync(stateFile, JSON.stringify({ pid: process.pid, dir: join(userData(), 'elsewhere') }))
    closeInstallWindow()
    expect(existsSync(stateFile)).toBe(process.platform !== 'win32')
    await new Promise(r => setTimeout(r, 1500))
    // Still running: this test was not killed
    expect(process.pid).toBeGreaterThan(0)
    // Nothing to do without the file, or with a broken one
    expect(() => closeInstallWindow()).not.toThrow()
    writeFileSync(stateFile, '{not json')
    expect(() => closeInstallWindow()).not.toThrow()
  })
})
