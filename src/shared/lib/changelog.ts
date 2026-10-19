// ─── CHANGELOG.md → versions for the release notes and "What's new" ──────────

export type ChangeType = 'new' | 'better' | 'fix' | 'other'
export type VersionKind = 'major' | 'minor' | 'patch' | 'pre'

export interface ChangeItem {
  type: ChangeType
  /** "assistant", "Design"… (the bold prefix), null when none */
  scope: string | null
  text: string
  sha: string | null
  url: string | null
}

export interface ChangelogVersion {
  version: string
  /** yyyy-mm-dd */
  date: string | null
  kind: VersionKind
  /** "> …" lines under the title */
  summary: string | null
  items: ChangeItem[]
  /** "_1 technical change…_" */
  note: string | null
}

/** Section titles of both languages (release script, Keep a Changelog) */
const TYPES: [RegExp, ChangeType][] = [
  [/^(nouveaut|new feature|feature|added|ajout)/i, 'new'],
  [/^(am[ée]lioration|improvement|performance|changed|modifi|s[ée]curit|security)/i, 'better'],
  [/^(correction|fix|bug)/i, 'fix']
]
const typeOf = (title: string): ChangeType => TYPES.find(([re]) => re.test(title.trim()))?.[1] ?? 'other'

const versionRe = /^## \[?([^\] ]+)\]?(?:\([^)]*\))?(?:\s*[—-]\s*(\d{4}-\d{2}-\d{2}))?/

function kindOf(version: string, older: string | undefined): VersionKind {
  if (version.includes('-')) return 'pre'
  const [a, b] = [version, older ?? '0.0.0'].map(v => v.split('-')[0].split('.').map(Number))
  if (a[0] !== b[0]) return 'major'
  if (a[1] !== b[1]) return 'minor'
  return 'patch'
}

/** "- **scope** : text ([abc1234](url))" */
function parseItem(line: string, type: ChangeType): ChangeItem {
  let text = line.replace(/^- /, '').trim()
  let sha: string | null = null
  let url: string | null = null
  const link = /\s*\(\[([0-9a-f]{7,40})\]\((https?:\/\/[^)]+)\)\)\s*$/.exec(text)
  if (link) { sha = link[1]; url = link[2]; text = text.slice(0, link.index).trim() }
  let scope: string | null = null
  const sc = /^\*\*([^*]+)\*\*\s*:\s*/.exec(text)
  if (sc) { scope = sc[1]; text = text.slice(sc[0].length) }
  return { type, scope, text, sha, url }
}

export function parseChangelog(markdown: string): ChangelogVersion[] {
  const blocks = markdown.replace(/\r/g, '').split(/\n(?=## )/).filter(b => b.startsWith('## '))
  const versions = blocks.map(block => {
    const [title, ...lines] = block.split('\n')
    const m = versionRe.exec(title)
    const v: ChangelogVersion = { version: m?.[1] ?? title.slice(3).trim(), date: m?.[2] ?? null, kind: 'patch', summary: null, items: [], note: null }
    let type: ChangeType = 'other'
    const summary: string[] = []
    for (const line of lines) {
      if (line.startsWith('### ')) type = typeOf(line.slice(4))
      else if (line.startsWith('- ')) v.items.push(parseItem(line, type))
      else if (line.startsWith('> ')) summary.push(line.slice(2).trim())
      else if (/^_.+_$/.test(line.trim())) v.note = line.trim().slice(1, -1)
    }
    v.summary = summary.join(' ') || null
    return v
  })
  versions.forEach((v, i) => { v.kind = kindOf(v.version, versions[i + 1]?.version) })
  return versions
}
