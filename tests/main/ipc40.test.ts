import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { assertProjectPath } from '../../src/main/lib/safe'
import { closeTail, openTail, rememberLogFile } from '../../src/main/services/logs/logTail'
import { saveProjects, tempDir } from '../helpers'

/** v4.0: what the window may name, through the IPC bridge, outside the projects */

const project = tempDir('shop')
mkdirSync(join(project, 'storage', 'logs'), { recursive: true })
const inside = join(project, 'storage', 'logs', 'laravel.log')
writeFileSync(inside, 'boot\nready\n')
const outside = join(tempDir('elsewhere'), 'secret.txt')
writeFileSync(outside, 'not for the window\n')
saveProjects([{ name: 'shop', path: project }])

const opened: string[] = []
afterAll(() => opened.forEach(closeTail))

describe('log files', () => {
  it('follows a file of a saved project', async () => {
    const r = await openTail(inside)
    opened.push(r.id)
    expect(r.lines).toEqual(['boot', 'ready'])
  })

  it('refuses any other file of the disk until the user picks it', async () => {
    await expect(openTail(outside)).rejects.toThrow(/Pick this file/)
    await expect(openTail('')).rejects.toThrow(/Invalid path/)
    await expect(openTail(42 as unknown as string)).rejects.toThrow(/Invalid path/)
    rememberLogFile(outside)
    const r = await openTail(outside.toUpperCase())
    opened.push(r.id)
    expect(r.lines).toEqual(['not for the window'])
  })
})

describe('project folders', () => {
  it('takes a project and the folders inside it, nothing else', () => {
    expect(assertProjectPath(project)).toBe(project)
    expect(assertProjectPath(join(project, 'storage'))).toBe(join(project, 'storage'))
    for (const bad of [tempDir('other'), 'C:\\Windows', 'relative', '', null, 42, join(project, '..')]) {
      expect(() => assertProjectPath(bad), String(bad)).toThrow(/Not a saved project/)
    }
  })
})
