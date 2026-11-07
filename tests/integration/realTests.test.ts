import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { detectRunners, runTests } from '../../src/main/services/tests/testRunner'
import { saveProject } from '../../src/main/services/projects/projectStorage'
import { venvPython } from '../../src/main/services/packages/otherUpdates'
import { tempDir } from '../helpers'

/**
 * v3.7 lot 4: the Tests tab's service with the real tools: Vitest (on
 * DevForge itself), Cargo, pytest in a .venv (pytest comes from PyPI).
 * Opt-in: DEVFORGE_REAL_TESTS=1, with Cargo and Python on the PATH.
 */
const file = (path: string, content: string) => { mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, content) }
const save = (id: string, path: string) => saveProject({ id, name: id, path, framework: 'unknown', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false })

describe.skipIf(!process.env.DEVFORGE_REAL_TESTS)('v3.7: real test runs', () => {
  it('vitest: one of DevForge\'s own test files, every test read', { timeout: 180_000 }, async () => {
    const repo = resolve(__dirname, '..', '..')
    save('devforge', repo)
    expect((await detectRunners(repo)).map(r => r.runner)).toContain('vitest')
    const lines: string[] = []
    const run = await runTests(repo, 'vitest', ['tests/main/lot37-3.test.ts'], l => lines.push(l))
    expect(run.error, lines.slice(-20).join('\n')).toBeUndefined()
    expect(run.files.map(f => f.file)).toEqual(['tests/main/lot37-3.test.ts'])
    expect(run.totals).toEqual({ passed: 2, failed: 0, skipped: 0 })
  })

  it('cargo: a crate with a failing test, its left and right, where it panicked', { timeout: 240_000 }, async () => {
    const root = tempDir('realcargo')
    execFileSync('cargo', ['init', '--lib', '--vcs', 'none', '--name', 'verify', '-q'], { cwd: root })
    writeFileSync(join(root, 'src', 'lib.rs'), 'pub fn add(a: i32, b: i32) -> i32 { a + b }\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n    #[test]\n    fn adds() { assert_eq!(add(2, 2), 4); }\n    #[test]\n    fn fails() { assert_eq!(add(2, 2), 5); }\n}\n')
    save('cargo', root)
    const run = await runTests(root, 'cargo', undefined, () => {})
    expect(run.totals).toEqual({ passed: 1, failed: 1, skipped: 0 })
    expect(run.files[0].tests.find(t => t.name === 'tests::fails')).toMatchObject({ expected: '5', actual: '4', location: { file: 'src/lib.rs', line: 9 } })
  })

  it('pytest: through the project\'s .venv, the failing assert read', { timeout: 240_000 }, async () => {
    const root = tempDir('realpytest')
    execFileSync('python', ['-m', 'venv', '.venv'], { cwd: root })
    execFileSync(venvPython(root)!, ['-m', 'pip', 'install', '-q', 'pytest'], { cwd: root })
    file(join(root, 'requirements-dev.txt'), 'pytest\n')
    file(join(root, 'tests', 'test_cart.py'), 'def total(xs):\n    return sum(xs)\n\n\ndef test_adds():\n    assert total([1, 2]) == 3\n\n\ndef test_discount():\n    assert total([100, -10]) == 85\n')
    save('pytest', root)
    expect((await detectRunners(root)).find(r => r.runner === 'pytest')).toEqual({ runner: 'pytest' })
    const run = await runTests(root, 'pytest', undefined, () => {})
    expect(run.totals).toEqual({ passed: 1, failed: 1, skipped: 0 })
    expect(run.files.map(f => f.file)).toEqual(['tests/test_cart.py'])
    expect(run.files[0].tests[1]).toMatchObject({ name: 'test_discount', expected: '85', actual: '90', location: { file: 'tests/test_cart.py', line: 10 } })
  })
})
