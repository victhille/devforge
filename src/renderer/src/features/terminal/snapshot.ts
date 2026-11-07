import type { IBufferCell, Terminal } from '@xterm/xterm'

/** One line of a finished block: runs of text with their color */
export interface Seg { text: string; fg?: string; bold?: boolean }
export type Line = Seg[]

export const XTERM_THEME = {
  background:  '#090B10',
  foreground:  '#D4D4D4',
  cursor:      '#4F8EF7',
  selectionBackground: 'rgba(79,142,247,0.3)',
  black:       '#1E2435', brightBlack:   '#4A5068',
  red:         '#F7615A', brightRed:     '#FF7875',
  green:       '#3DD68C', brightGreen:   '#5EF9A8',
  yellow:      '#F5A623', brightYellow:  '#FFD666',
  blue:        '#4F8EF7', brightBlue:    '#74AAFF',
  magenta:     '#A78BFA', brightMagenta: '#C4B5FD',
  cyan:        '#38BDF8', brightCyan:    '#7DD3FC',
  white:       '#CBD5E1', brightWhite:   '#F1F5F9'
}

const BASE16 = [
  XTERM_THEME.black, XTERM_THEME.red, XTERM_THEME.green, XTERM_THEME.yellow, XTERM_THEME.blue, XTERM_THEME.magenta, XTERM_THEME.cyan, XTERM_THEME.white,
  XTERM_THEME.brightBlack, XTERM_THEME.brightRed, XTERM_THEME.brightGreen, XTERM_THEME.brightYellow, XTERM_THEME.brightBlue, XTERM_THEME.brightMagenta, XTERM_THEME.brightCyan, XTERM_THEME.brightWhite
]
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

/** xterm's 256 colors: 16 of the theme, a 6×6×6 cube, 24 greys */
function palette(i: number): string {
  if (i < 16) return BASE16[i]
  if (i < 232) {
    const v = i - 16, step = (c: number) => (c ? c * 40 + 55 : 0)
    return hex((step(Math.floor(v / 36)) << 16) | (step(Math.floor(v / 6) % 6) << 8) | step(v % 6))
  }
  const g = (i - 232) * 10 + 8
  return hex((g << 16) | (g << 8) | g)
}

function colorOf(c: IBufferCell): string | undefined {
  if (c.isFgDefault()) return undefined
  if (c.isFgPalette()) return palette(c.getFgColor())
  return hex(c.getFgColor())
}

/**
 * The block's screen and scrollback as colored lines: what the user saw,
 * progress bars and \r rewrites already settled by xterm. The echo of the
 * command (the first line) and the empty lines at the end are dropped.
 */
export function snapshot(term: Terminal, cmd: string): Line[] {
  const buf = term.buffer.active
  const lines: Line[] = []
  for (let y = 0; y < buf.length; y++) {
    const row = buf.getLine(y)
    if (!row) continue
    const line: Line = []
    let cell: IBufferCell | undefined
    for (let x = 0; x < row.length; x++) {
      cell = row.getCell(x, cell)
      if (!cell || cell.getWidth() === 0) continue
      const text = cell.getChars() || ' '
      const fg = colorOf(cell)
      const bold = cell.isBold() !== 0
      const last = line[line.length - 1]
      if (last && last.fg === fg && !!last.bold === bold) last.text += text
      else line.push({ text, ...(fg ? { fg } : {}), ...(bold ? { bold } : {}) })
    }
    // Trailing spaces of the row
    while (line.length && !line[line.length - 1].text.trimEnd()) line.pop()
    if (line.length) line[line.length - 1].text = line[line.length - 1].text.trimEnd()
    // A wrapped row continues the previous line
    if (row.isWrapped && lines.length) lines[lines.length - 1].push(...line)
    else lines.push(line)
  }
  const textOf = (l: Line) => l.map(s => s.text).join('')
  const head = cmd.trim().slice(0, 40)
  // The echo of the command, and what a shell printed before it (cmd's banner on its first line)
  const echo = head ? lines.slice(0, 8).findIndex(l => textOf(l).includes(head)) : -1
  if (echo >= 0) lines.splice(0, echo + 1)
  while (lines.length && !textOf(lines[lines.length - 1]).trim()) lines.pop()
  return lines
}

export const lineText = (l: Line) => l.map(s => s.text).join('')
