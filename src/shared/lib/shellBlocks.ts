/**
 * Terminal in blocks (v2.2 lot 5). The shells are taught to mark their
 * prompt with invisible OSC 633 sequences (the ones VS Code uses):
 *   ESC ] 633 ; A BEL          the prompt starts (the previous command ended)
 *   ESC ] 633 ; D ; <code> BEL its exit code
 *   ESC ] 633 ; P ; Cwd=<dir>  the current folder
 *   ESC ] 633 ; B BEL          the prompt ends: the shell waits for a command
 * The parser below turns the shell's output into data and these events,
 * whatever the way the chunks are cut.
 */

export type ShellEvent =
  | { type: 'data'; text: string }
  | { type: 'prompt-start' }
  /** tag: the block it belongs to, when the shell can say (cmd) */
  | { type: 'exit-code'; code: number; tag?: string }
  | { type: 'cwd'; path: string }
  | { type: 'prompt-end' }

const OSC = '\x1b]633;'

export class MarkerParser {
  private pending = ''

  feed(chunk: string): ShellEvent[] {
    const events: ShellEvent[] = []
    let s = this.pending + chunk
    this.pending = ''
    for (;;) {
      const at = s.indexOf(OSC)
      if (at < 0) {
        // A marker may start at the very end of this chunk: keep that tail for the next one
        const tail = partialPrefix(s)
        if (s.length - tail > 0) push(events, s.slice(0, s.length - tail))
        this.pending = s.slice(s.length - tail)
        return events
      }
      if (at > 0) push(events, s.slice(0, at))
      // BEL or ESC \ (cmd's prompt can only write the latter)
      const rest = s.slice(at + OSC.length)
      const bel = rest.indexOf('\x07')
      const st = rest.indexOf('\x1b\\')
      const end = bel < 0 ? st : st < 0 ? bel : Math.min(bel, st)
      if (end < 0) { this.pending = s.slice(at); return events }
      const body = rest.slice(0, end)
      s = rest.slice(end + (end === bel ? 1 : 2))
      const ev = toEvent(body)
      if (ev) events.push(ev)
    }
  }
}

function push(events: ShellEvent[], text: string): void {
  if (!text) return
  const last = events[events.length - 1]
  if (last?.type === 'data') last.text += text
  else events.push({ type: 'data', text })
}

/** Length of the end of `s` that could be the start of a marker */
function partialPrefix(s: string): number {
  for (let n = Math.min(OSC.length - 1, s.length); n > 0; n--) if (OSC.startsWith(s.slice(-n))) return n
  return 0
}

function toEvent(body: string): ShellEvent | null {
  if (body === 'A') return { type: 'prompt-start' }
  if (body === 'B') return { type: 'prompt-end' }
  if (body.startsWith('D;')) {
    const [raw, tag] = body.slice(2).split(';')
    const code = Number(raw)
    if (!raw || !Number.isFinite(code)) return null
    return tag ? { type: 'exit-code', code, tag } : { type: 'exit-code', code }
  }
  if (body.startsWith('P;Cwd=')) return { type: 'cwd', path: body.slice(6) }
  return null
}

// ─── Shell integration ─────────────────────────────────────────────────────────

export type ShellKind = 'powershell' | 'pwsh' | 'gitbash' | 'cmd' | 'ssh'

/**
 * PowerShell: a prompt that writes the markers. $? first (any other line
 * would change it); a failed native program gives its own exit code.
 * PSReadLine goes: DevForge has its own input, and PSReadLine would echo
 * the command with colors and predictions.
 */
export const POWERSHELL_INIT = [
  'Remove-Module PSReadLine -ErrorAction SilentlyContinue',
  'function global:prompt {',
  '  $ok = $global:?',
  // $LASTEXITCODE keeps the last program\'s code: it counts only when it changed since the previous prompt
  '  $lec = $global:LASTEXITCODE',
  '  $code = if ($ok) { 0 } elseif ($lec -and $lec -ne $global:__dfLastExit) { $lec } else { 1 }',
  '  $global:__dfLastExit = $lec',
  '  $e = [char]27; $b = [char]7',
  '  "$e]633;A$b$e]633;D;$code$b$e]633;P;Cwd=$($executionContext.SessionState.Path.CurrentLocation.ProviderPath)$b" + "PS> " + "$e]633;B$b"',
  '}'
].join('\n')

/** Bash (Git Bash on this PC, or the server's shell over SSH) */
export const BASH_INIT = [
  "__df_prompt() { local c=$?; printf '\\033]633;A\\007\\033]633;D;%s\\007\\033]633;P;Cwd=%s\\007' \"$c\" \"$PWD\"; }",
  'PROMPT_COMMAND=__df_prompt',
  "PS1='$ \\[\\033]633;B\\007\\]'"
].join('\n')

/** cmd's prompt; `exit`: the D marker's body (cmd's prompt cannot read %errorlevel% itself) */
const cmdPrompt = (exit?: string) => `$E]633;A$E\\${exit ? `$E]633;D;${exit}$E\\` : ''}$E]633;P;Cwd=$P$E\\$G $E]633;B$E\\`
export const CMD_PROMPT = cmdPrompt()

/**
 * The line DevForge types in cmd: the command, then a prompt that carries its
 * exit code. %^errorlevel% is read only when `call` runs, after the command
 * (the caret keeps it from the first reading); the block's tag tells a fresh
 * code from the one of a line that never reached the call (rem, a syntax error).
 */
export const cmdLine = (cmd: string, tag: string) => `${cmd} & call prompt ${cmdPrompt(`%^errorlevel%;${tag}`)}`

/** Over SSH, typed as one line (a leading space keeps it out of the history) */
export const sshInitLine = () => ` ${BASH_INIT.split('\n').join('; ')}; clear\n`

/** PowerShell's -EncodedCommand: UTF-16LE in base64, no quoting problem */
export function encodePowerShell(script: string): string {
  const bytes: number[] = []
  for (const ch of script) {
    const c = ch.charCodeAt(0)
    bytes.push(c & 0xff, c >> 8)
  }
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return typeof btoa === 'function' ? btoa(bin) : Buffer.from(bin, 'binary').toString('base64')
}
