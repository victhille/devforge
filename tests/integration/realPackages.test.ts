import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { listOtherManifests } from '../../src/main/services/packages/otherPackages'
import { missingTool, otherUpdate, venvPython } from '../../src/main/services/packages/otherUpdates'
import { tempDir } from '../helpers'

/**
 * v3.6 lot 6: Python and Rust packages updated with the real tools (PyPI and
 * crates.io reached). Opt-in: DEVFORGE_REAL_PKG=1, with Python and Cargo on the PATH.
 */
describe.skipIf(!process.env.DEVFORGE_REAL_PKG)('v3.6: real package updates', () => {
  it('pip: through the project\'s .venv, a pinned package moved to the latest, the file rewritten', { timeout: 240_000 }, async () => {
    const root = tempDir('realpy')
    execFileSync('python', ['-m', 'venv', '.venv'], { cwd: root })
    writeFileSync(join(root, 'requirements.txt'), 'idna==3.6\n')
    execFileSync(venvPython(root)!, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt'], { cwd: root })
    expect(await missingTool('pip', root)).toBeUndefined()

    const [m] = listOtherManifests(root)
    expect(m).toMatchObject({ file: 'requirements.txt', manager: 'pip', packages: [{ name: 'idna', wanted: '==3.6', installed: '3.6' }] })
    const log: string[] = []
    const r = await otherUpdate(root, m, [{ name: 'idna', dev: false, target: 'latest' }], l => log.push(l))
    expect(r.ok, log.join('\n')).toBe(true)
    const after = listOtherManifests(root)[0].packages[0]
    expect(after.installed).not.toBe('3.6')
    expect(readFileSync(join(root, 'requirements.txt'), 'utf-8')).toBe(`idna>=${after.installed}\n`)
  })

  it('cargo: a crate updated within its range, Cargo.lock changed, and a failure puts the files back', { timeout: 240_000 }, async () => {
    const root = tempDir('realrs')
    execFileSync('cargo', ['init', '--vcs', 'none', '--name', 'verify', '-q'], { cwd: root })
    writeFileSync(join(root, 'Cargo.toml'), readFileSync(join(root, 'Cargo.toml'), 'utf-8').replace('[dependencies]', '[dependencies]\nitoa = "1.0.0"'))
    execFileSync('cargo', ['generate-lockfile', '-q'], { cwd: root })
    execFileSync('cargo', ['update', '-q', '-p', 'itoa', '--precise', '1.0.1'], { cwd: root })
    expect(await missingTool('cargo', root)).toBeUndefined()

    const [m] = listOtherManifests(root)
    expect(m.packages).toEqual([{ name: 'itoa', wanted: '1.0.0', installed: '1.0.1', dev: false }])
    const log: string[] = []
    expect((await otherUpdate(root, m, [{ name: 'itoa', dev: false, target: 'compatible' }], l => log.push(l))).ok, log.join('\n')).toBe(true)
    const installed = listOtherManifests(root)[0].packages[0].installed!
    expect(installed.startsWith('1.')).toBe(true)
    expect(installed).not.toBe('1.0.1')

    // A crate that does not exist: cargo fails, Cargo.toml and Cargo.lock come back
    const before = [readFileSync(join(root, 'Cargo.toml'), 'utf-8'), readFileSync(join(root, 'Cargo.lock'), 'utf-8')]
    const failed = await otherUpdate(root, { ...m, packages: [...m.packages, { name: 'devforge-no-such-crate-xyz', wanted: '1', installed: null, dev: false }] },
      [{ name: 'devforge-no-such-crate-xyz', dev: false, target: 'compatible' }], () => {})
    expect(failed).toEqual({ ok: false, restored: true })
    expect([readFileSync(join(root, 'Cargo.toml'), 'utf-8'), readFileSync(join(root, 'Cargo.lock'), 'utf-8')]).toEqual(before)
  })
})
