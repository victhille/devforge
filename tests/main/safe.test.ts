import { writeFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { assertSafeDir, assertScriptName, assertWebUrl, isInsideProject } from '../../src/main/lib/safe'
import { saveProjects, tempDir } from '../helpers'

describe('assertWebUrl', () => {
  it('lets http(s) and mailto through', () => {
    expect(assertWebUrl('https://example.com')).toBe('https://example.com')
    expect(assertWebUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
  })
  it.each(['file:///C:/Windows/win.ini', 'javascript:alert(1)', 'vscode://x', 'ms-settings:', '', 42, null])('refuses %s', url => {
    expect(() => assertWebUrl(url)).toThrow()
  })
})

describe('assertScriptName', () => {
  it.each(['dev', 'build:prod', 'test:e2e', 'lint-fix', '@scope/x'])('accepts %s', n => expect(assertScriptName(n)).toBe(n))
  it.each(['dev & calc', 'a;b', 'x|y', '$(id)', 'a b', '', '"q"'])('refuses %s', n => expect(() => assertScriptName(n)).toThrow())
})

describe('assertSafeDir', () => {
  it('accepts an existing absolute folder', () => {
    const dir = tempDir()
    expect(assertSafeDir(dir)).toBe(dir)
  })
  it('refuses relative paths, files, missing folders and shell metacharacters', () => {
    const dir = tempDir()
    const file = join(dir, 'f.txt')
    writeFileSync(file, '')
    expect(() => assertSafeDir('relative/path')).toThrow()
    expect(() => assertSafeDir(file)).toThrow()
    expect(() => assertSafeDir(join(dir, 'missing'))).toThrow()
    for (const bad of ['&', '|', '%', '"', '^', '<', '!']) expect(() => assertSafeDir(`${dir}${bad}calc`)).toThrow()
    expect(() => assertSafeDir(undefined)).toThrow()
  })
})

describe('isInsideProject', () => {
  it('only allows saved project folders and their children', () => {
    const project = tempDir('proj')
    saveProjects([{ name: 'p', path: project }])
    expect(isInsideProject(project)).toBe(true)
    expect(isInsideProject(join(project, 'src', 'a'))).toBe(true)
    expect(isInsideProject(join(project, '..'))).toBe(false)
    expect(isInsideProject(join(project, '..', 'other'))).toBe(false)
    expect(isInsideProject(`${project}-evil`)).toBe(false)
  })
})
