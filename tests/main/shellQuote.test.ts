import { execFileSync } from 'child_process'
import { describe, expect, it } from 'vitest'
import type { DeployTarget } from '@shared/types'
import { shQuote } from '../../src/main/services/ssh/sshClient'
import { buildRemoteCommand } from '../../src/main/services/deploy/deployService'

/** Script through stdin: Windows would rewrite backslashes in a command-line argument */
const run = (sh: string, script: string) => execFileSync(sh, ['-s'], { input: script, encoding: 'utf-8' })

/** A POSIX sh to check quoting for real (Git Bash on Windows, sh elsewhere) */
function findSh(): string | null {
  for (const sh of process.platform === 'win32' ? ['C:/Program Files/Git/bin/sh.exe', 'sh'] : ['sh']) {
    try { if (run(sh, 'echo ok').trim() === 'ok') return sh } catch { /* next */ }
  }
  return null
}
const sh = findSh()

const NASTY = [
  "it's",
  'say "hi"',
  '$HOME $(id) `whoami` ${PATH}',
  'a\\b\\\\c',
  'line1\nline2',
  '; rm -rf / #',
  ''
]

describe('shQuote', () => {
  it('wraps in single quotes', () => {
    expect(shQuote('abc')).toBe("'abc'")
    expect(shQuote("it's")).toBe("'it'\\''s'")
  })

  it.skipIf(!sh).each(NASTY)('round-trips through a real shell: %j', s => {
    // The login shell receives `printf %s <quoted>` and must print it unchanged
    const out = run(sh!, `printf %s ${shQuote(s)}`)
    expect(out).toBe(s)
  })

  it.skipIf(!sh)('keeps $ and $(...) for the inner bash -c, like remote scripts need', () => {
    const script = 'X=inner; echo "$X"'
    const out = run(sh!, `sh -c ${shQuote(script)}`)
    expect(out.trim()).toBe('inner')
  })
})

describe('buildRemoteCommand', () => {
  const target = { id: 't', name: 't', connectionId: 's', remotePath: "/srv/my app's", script: '# comment\ngit pull\n\nnpm ci' } as DeployTarget

  it('runs each non-comment line with set -e in the remote folder', () => {
    const cmd = buildRemoteCommand(target)
    expect(cmd.startsWith('bash -lc ')).toBe(true)
    expect(cmd).not.toContain('# comment')
  })

  it.skipIf(!sh)('produces a script a shell parses as intended', () => {
    // Replace the outer `bash -lc` by `printf %s` to see what bash would run
    const body = run(sh!, buildRemoteCommand(target).replace(/^bash -lc /, 'printf %s '))
    expect(body.split('\n')).toEqual([
      'set -e',
      "cd '/srv/my app'\\''s'",
      "echo '$ git pull'",
      'git pull',
      "echo '$ npm ci'",
      'npm ci'
    ])
  })
})
