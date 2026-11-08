export type DiffType = 'equal' | 'add' | 'remove'
export interface DiffLine { type: DiffType; text: string }

export interface DiffOptions {
  /** Lines that differ only by spaces or tabs (indent, trailing, doubled) count as equal */
  ignoreWhitespace?: boolean
}

/** Line-based diff using a longest-common-subsequence table. */
export function computeDiff(a: string, b: string, opts: DiffOptions = {}): DiffLine[] {
  const aLines = a.split('\n')
  const bLines = b.split('\n')
  const m = aLines.length
  const n = bLines.length
  const key = opts.ignoreWhitespace ? (s: string) => s.trim().replace(/\s+/g, ' ') : (s: string) => s
  const aKeys = aLines.map(key)
  const bKeys = bLines.map(key)

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = aKeys[i - 1] === bKeys[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  const result: DiffLine[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aKeys[i - 1] === bKeys[j - 1]) {
      // An equal line shows as in the modified text
      result.unshift({ type: 'equal', text: bLines[j - 1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', text: bLines[j - 1] }); j--
    } else {
      result.unshift({ type: 'remove', text: aLines[i - 1] }); i--
    }
  }
  return result
}
