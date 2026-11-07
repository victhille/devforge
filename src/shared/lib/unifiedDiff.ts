/**
 * v3.7 lot 3: a file's changes since the last commit, read from `git diff`
 * into lines with their old and new numbers, for the Files tab's preview.
 */

export interface DiffLine { kind: 'context' | 'add' | 'del'; text: string; oldNo: number | null; newNo: number | null }
export interface DiffHunk { header: string; lines: DiffLine[] }
export interface ParsedDiff { hunks: DiffHunk[]; added: number; removed: number; binary: boolean }

export function parseUnifiedDiff(text: string): ParsedDiff {
  const out: ParsedDiff = { hunks: [], added: 0, removed: 0, binary: /^Binary files .* differ$/m.test(text) }
  let hunk: DiffHunk | null = null
  let oldNo = 0
  let newNo = 0
  for (const raw of text.split(/\r?\n/)) {
    const h = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/)
    if (h) {
      hunk = { header: raw, lines: [] }
      out.hunks.push(hunk)
      oldNo = Number(h[1])
      newNo = Number(h[2])
      continue
    }
    if (!hunk || raw.startsWith('\\')) continue
    if (raw.startsWith('+')) { hunk.lines.push({ kind: 'add', text: raw.slice(1), oldNo: null, newNo: newNo++ }); out.added++ }
    else if (raw.startsWith('-')) { hunk.lines.push({ kind: 'del', text: raw.slice(1), oldNo: oldNo++, newNo: null }); out.removed++ }
    else if (raw.startsWith(' ')) hunk.lines.push({ kind: 'context', text: raw.slice(1), oldNo: oldNo++, newNo: newNo++ })
  }
  return out
}

/** A new file (not in Git yet): every line added */
export function newFileDiff(content: string): string {
  const lines = content.replace(/\r?\n$/, '').split(/\r?\n/)
  return `@@ -0,0 +1,${lines.length} @@\n${lines.map(l => `+${l}`).join('\n')}\n`
}
