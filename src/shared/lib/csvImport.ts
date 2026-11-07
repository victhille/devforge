/**
 * v3.6 lot 4: a CSV read for import: its separator guessed, quotes and line
 * breaks inside quotes kept (RFC 4180), columns matched to the table's by name.
 */

export type CsvSeparator = ',' | ';' | '\t' | '|'

/** The separator the first line uses most (outside quotes) */
export function guessSeparator(text: string): CsvSeparator {
  const first = text.slice(0, text.search(/\r?\n/) >= 0 ? text.search(/\r?\n/) : undefined)
  const counts: Record<CsvSeparator, number> = { ',': 0, ';': 0, '\t': 0, '|': 0 }
  let quoted = false
  for (const c of first) {
    if (c === '"') quoted = !quoted
    else if (!quoted && c in counts) counts[c as CsvSeparator]++
  }
  const [best, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return (n > 0 ? best : ',') as CsvSeparator
}

/** Every row's cells; a blank last line is dropped */
export function parseCsv(text: string, sep: CsvSeparator): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const s = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => !(r.length === 1 && r[0] === ''))
}

/** Text as UTF-8, or Windows-1252 when it is not valid UTF-8 (Excel's "CSV" in French) */
export function decodeCsv(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1252' } {
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' } }
  catch { return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' } }
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '')

/** Each CSV column → the table column of the same name (case, spaces, _ and - ignored), or null */
export function matchColumns(headers: string[], columns: string[]): (string | null)[] {
  const used = new Set<string>()
  return headers.map(h => {
    const found = columns.find(c => !used.has(c) && norm(c) === norm(h)) ?? null
    if (found) used.add(found)
    return found
  })
}
