import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { decodeLine, lineCollapser, lineReader, stripAnsi } from '../../src/main/services/system/commandRunner'
import { loadProjects, saveProject } from '../../src/main/services/projects/projectStorage'
import { userData } from '../helpers'

/** v3.3.1: the creation and script logs stay readable */
describe('v3.3.1: log lines', () => {
  it('strips OSC 8 links, ended by BEL or by ESC \\', () => {
    expect(stripAnsi('Created \x1b]8;;file:///C:/app/src/Entity/User.php\x1b\\src/Entity/User.php\x1b]8;;\x1b\\')).toBe('Created src/Entity/User.php')
    expect(stripAnsi('\x1b]8;;https://x.dev\x07link\x1b]8;;\x07')).toBe('link')
    expect(stripAnsi('\x1b[32mok\x1b[39m')).toBe('ok')
  })

  it.runIf(process.platform === 'win32')('reads cmd\'s own messages in code page 850', () => {
    expect(decodeLine(Buffer.from([0x65, 0x78, 0x82, 0x63]))).toBe('exéc')
    expect(decodeLine(Buffer.from('déjà', 'utf8'))).toBe('déjà')
  })

  it('splits lines at the bytes: a character cut between two chunks survives', () => {
    const lines: string[] = []
    const reader = lineReader(l => lines.push(l))
    const bytes = Buffer.from('première ligne\r\nseconde', 'utf8')
    const cut = bytes.indexOf(0xa8) // inside "è"
    reader.write(bytes.subarray(0, cut))
    reader.write(bytes.subarray(cut))
    reader.end()
    expect(lines).toEqual(['première ligne', 'seconde'])
  })

  it('collapses runs of the same warning into one line and a count', () => {
    const out: string[] = []
    const c = lineCollapser(text => out.push(text))
    for (let i = 0; i < 300; i++) c.push(`warning: in the working copy of 'f${i}.js', LF will be replaced by CRLF the next time Git touches it`, 'stderr')
    c.push('Deprecation Notice: a', 'stderr')
    c.push('Deprecation Notice: b', 'stderr')
    c.push('done', 'stdout')
    c.push('done', 'stdout')
    c.flush()
    expect(out).toEqual([
      "warning: in the working copy of 'f0.js', LF will be replaced by CRLF the next time Git touches it", '… (+299)',
      'Deprecation Notice: a', '… (+1)',
      'done', '… (+1)'
    ])
  })
})

describe('v3.3.1: projects whose folder is gone', () => {
  it('never saves the "missing" flag worked out on load', () => {
    saveProject({ id: 'p1', name: 'gone', path: join(userData(), 'nowhere'), framework: 'nodejs', packageManager: 'npm', createdAt: '', lastOpenedAt: null, favorite: false, missing: true })
    const file = join(userData(), 'projects.json')
    expect(existsSync(file)).toBe(true)
    expect(readFileSync(file, 'utf-8')).not.toContain('missing')
    expect(loadProjects()[0]).not.toHaveProperty('missing')
  })
})
