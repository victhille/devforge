import { describe, expect, it } from 'vitest'
import { MarkerParser, encodePowerShell, type ShellEvent } from '../../src/shared/lib/shellBlocks'

const A = '\x1b]633;A\x07', B = '\x1b]633;B\x07'
const D = (c: number) => `\x1b]633;D;${c}\x07`
const P = (p: string) => `\x1b]633;P;Cwd=${p}\x07`

/** Feeds the text cut every `size` characters, merges the data events */
function parse(text: string, size = text.length): ShellEvent[] {
  const p = new MarkerParser()
  const out: ShellEvent[] = []
  for (let i = 0; i < text.length; i += size) {
    for (const e of p.feed(text.slice(i, i + size))) {
      const last = out[out.length - 1]
      if (e.type === 'data' && last?.type === 'data') last.text += e.text
      else out.push(e)
    }
  }
  return out
}

describe('v2.2 lot 5: shell markers', () => {
  const stream = `git status\r\nOn branch main\r\n${A}${D(0)}${P('C:\\dev\\boutique')}PS> ${B}`
  const expected: ShellEvent[] = [
    { type: 'data', text: 'git status\r\nOn branch main\r\n' },
    { type: 'prompt-start' }, { type: 'exit-code', code: 0 }, { type: 'cwd', path: 'C:\\dev\\boutique' },
    { type: 'data', text: 'PS> ' }, { type: 'prompt-end' }
  ]

  it('splits data and markers', () => {
    expect(parse(stream)).toEqual(expected)
  })

  it('whatever the way the chunks are cut', () => {
    for (const size of [1, 2, 3, 5, 7, 13]) expect(parse(stream, size)).toEqual(expected)
  })

  it('ST terminator (cmd), unknown markers ignored, other escapes kept', () => {
    expect(parse(`\x1b[32mok\x1b[0m\x1b]633;A\x1b\\\x1b]633;X;y\x07\x1b]0;title\x07`)).toEqual([
      { type: 'data', text: '\x1b[32mok\x1b[0m' }, { type: 'prompt-start' }, { type: 'data', text: '\x1b]0;title\x07' }
    ])
  })

  it('exit codes of failed commands', () => {
    expect(parse(`${A}${D(127)}`)).toEqual([{ type: 'prompt-start' }, { type: 'exit-code', code: 127 }])
  })

  it('PowerShell -EncodedCommand is UTF-16LE base64', () => {
    expect(Buffer.from(encodePowerShell('é$a'), 'base64').toString('utf16le')).toBe('é$a')
  })
})

describe.runIf(process.platform === 'win32')('v2.2 lot 5: real shells mark their prompt', async () => {
  const term = await import('../../src/main/services/terminal/terminalService')
  const { tempDir } = await import('../helpers')

  /** Runs commands one after the other; returns each one's exit code, output and the folder after it */
  async function runAll(kind: 'powershell' | 'gitbash' | 'cmd', cmds: string[]) {
    const dir = tempDir('term')
    const parser = new MarkerParser()
    const results: { code: number | null; out: string; cwd: string }[] = []
    let current: { code: number | null; out: string; cwd: string } | null = null
    let ready: () => void = () => {}
    let promptCount = 0
    let inPrompt = false
    const id = term.create(kind, dir, 120, 30, (_id, data) => {
      for (const e of parser.feed(data)) {
        if (e.type === 'prompt-start') inPrompt = true
        else if (e.type === 'exit-code' && current) current.code = e.code
        else if (e.type === 'cwd' && current) current.cwd = e.path
        else if (e.type === 'data' && current && !inPrompt) current.out += e.text
        else if (e.type === 'prompt-end') { inPrompt = false; promptCount++; ready() }
      }
    }, () => {})
    const waitPrompt = (n: number) => new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`no prompt from ${kind}`)), 20_000)
      ready = () => { if (promptCount >= n) { clearTimeout(t); resolve() } }
      ready()
    })
    try {
      await waitPrompt(1)
      for (const [i, cmd] of cmds.entries()) {
        current = { code: null, out: '', cwd: '' }
        term.write(id, `${cmd}\r`)
        await waitPrompt(i + 2)
        results.push(current)
      }
    } finally {
      term.kill(id)
      // The shell lets go of the folder before the test removes it
      await new Promise(r => setTimeout(r, 500))
    }
    return results
  }
  // eslint-disable-next-line no-control-regex -- ESC and BEL are what we strip
  const plain = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g, '')

  it('PowerShell: exit codes of programs and cmdlets, the folder', async () => {
    const r = await runAll('powershell', ['Write-Output "bonjour"', 'cmd /c exit 3', 'Get-Item C:\nope-devforge', 'cd ..'])
    expect(plain(r[0].out)).toContain('bonjour')
    expect(r.map(x => x.code)).toEqual([0, 3, 1, 0])
    expect(r[3].cwd.toLowerCase()).not.toContain('term-')
  }, 60_000)

  it.runIf(term.shells && (await term.shells()).find(s => s.kind === 'gitbash')?.available)('Git Bash: $? of each command', async () => {
    const r = await runAll('gitbash', ['echo bonjour', 'false', 'ls /nope-devforge', 'cd /'])
    expect(plain(r[0].out)).toContain('bonjour')
    expect(r.map(x => x.code)).toEqual([0, 1, 2, 0])
    expect(r[3].cwd).toBe('/')
  }, 60_000)

  it('cmd: blocks without exit code', async () => {
    const r = await runAll('cmd', ['echo bonjour', 'cd ..'])
    expect(plain(r[0].out)).toContain('bonjour')
    expect(r.map(x => x.code)).toEqual([null, null])
  }, 60_000)
})
