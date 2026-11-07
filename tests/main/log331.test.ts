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
    c.push('done', 'stdout')
    c.push('done', 'stdout')
    c.end()
    expect(out).toEqual([
      "warning: in the working copy of 'f0.js', LF will be replaced by CRLF the next time Git touches it", '… (+299)',
      'done', '… (+1)'
    ])
  })

  it('shows the first deprecation notice, counts the scattered others, and drops progress bars', () => {
    const out: string[] = []
    const c = lineCollapser(text => out.push(text))
    const notice = 'Deprecation Notice: Constant E_STRICT is deprecated in phar://C:/composer/composer.phar/src/Composer/Util/Silencer.php:36'
    c.push(notice, 'stderr')
    c.push('Updating dependencies', 'stdout')
    c.push(notice, 'stderr')
    c.push('    0 [>---------------------------]    0 [->--------------------------]', 'stdout')
    c.push(`  10/100 [==>-------------------------]  10%${notice}`, 'stderr')
    c.push(' 100/100 [============================] 100%', 'stdout')
    c.push('Writing lock file', 'stdout')
    c.end()
    expect(out).toEqual([notice, 'Updating dependencies', 'Writing lock file', '… (+2) Deprecation Notice — composer self-update'])
  })

  it('keeps a Docker build step\'s title and end, counts what runs inside', () => {
    const out: string[] = []
    const c = lineCollapser(text => out.push(text))
    for (const l of [
      '#11 [ 5/15] RUN apt-get update', '#11 0.370 Get:1 http://archive.ubuntu.com noble InRelease', '#11 0.500 Get:2 http://security.ubuntu.com',
      '(Reading database ... 5%', '(Reading database ... 100%', '#11 33.33 Unpacking libexpat1', '#11 DONE 177.9s'
    ]) c.push(l, 'stdout')
    c.end()
    expect(out).toEqual(['#11 [ 5/15] RUN apt-get update', '#11 0.370 Get:1 http://archive.ubuntu.com noble InRelease', '… (+2)', '#11 DONE 177.9s'])
  })

  it('ends a line on a lone carriage return (a bar redrawn in place)', () => {
    const lines: string[] = []
    const reader = lineReader(l => lines.push(l))
    reader.write(Buffer.from('  0/10 [>---]   0%\r 10/10 [====] 100%\r\nDone\n'))
    reader.end()
    expect(lines).toEqual(['  0/10 [>---]   0%', ' 10/10 [====] 100%', 'Done'])
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
