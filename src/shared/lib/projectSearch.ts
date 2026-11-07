/**
 * v3.6 lot 5: searching a whole project from its Files tab. Pure parts: the
 * pattern built from what is typed, the file filter, the lines found.
 */

export interface SearchOptions {
  regex: boolean
  caseSensitive: boolean
  wholeWord: boolean
  /** "*.ts, src/**, !*.test.ts": the files to look in (empty: all) */
  include: string
}

export interface SearchMatch { line: number; column: number; length: number; text: string }
export interface SearchFile { path: string; matches: SearchMatch[] }
export interface SearchResult { files: SearchFile[]; total: number; truncated: boolean; error?: string; durationMs: number }

export const MAX_MATCHES = 1000
/** A found line is cut around its match past this */
const MAX_LINE = 240

/** What is typed, as a global RegExp; an invalid regex says why */
export function buildPattern(query: string, o: Pick<SearchOptions, 'regex' | 'caseSensitive' | 'wholeWord'>): RegExp | { error: string } {
  const body = o.regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  try {
    return new RegExp(o.wholeWord ? `\\b(?:${body})\\b` : body, o.caseSensitive ? 'g' : 'gi')
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

function globToRegex(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++ }
    else if (c === '*') re += '[^/]*'
    else if (c === '?') re += '[^/]'
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`, 'i')
}

/**
 * The file filter: comma-separated globs; "!" leaves out. A glob without "/"
 * looks at the name only (*.ts), one with "/" at the path (src/**).
 */
export function fileFilter(include: string): (relPath: string) => boolean {
  const parts = include.split(',').map(s => s.trim()).filter(Boolean)
  const test = (glob: string) => {
    const re = globToRegex(glob.replace(/^\.\//, '').replace(/\/$/, '/**'))
    return glob.includes('/') ? (p: string) => re.test(p) : (p: string) => re.test(p.split('/').pop() ?? p)
  }
  const ins = parts.filter(p => !p.startsWith('!')).map(test)
  const outs = parts.filter(p => p.startsWith('!')).map(p => test(p.slice(1)))
  return p => (!ins.length || ins.some(t => t(p))) && !outs.some(t => t(p))
}

/** Every match in a file's text, lines numbered from 1, at most `room` of them */
export function findInText(text: string, pattern: RegExp, room: number): SearchMatch[] {
  const out: SearchMatch[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length && out.length < room; i++) {
    const line = lines[i]
    pattern.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = pattern.exec(line)) && out.length < room) {
      if (m[0] === '') { pattern.lastIndex++; continue }
      // A long line (minified code): a window around the match
      const start = line.length > MAX_LINE ? Math.max(0, m.index - 60) : 0
      const shown = line.length > MAX_LINE ? line.slice(start, start + MAX_LINE) : line
      out.push({ line: i + 1, column: m.index - start, length: Math.min(m[0].length, shown.length - (m.index - start)), text: shown })
    }
  }
  return out
}
