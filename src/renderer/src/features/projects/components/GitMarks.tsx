import { useEffect, useState } from 'react'
import type { FileChangeStatus } from '@shared/types'
import { parseUnifiedDiff, type ParsedDiff } from '@shared/lib/unifiedDiff'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Spinner from '@renderer/components/ui/Spinner'

/**
 * v3.7 lot 3 (piste A of the mock-up): what Git says of the tree's files:
 * a colour and a letter per changed file, a dot on folders holding one,
 * and a file's changes as a diff.
 */

export type GitStates = Record<string, FileChangeStatus>

export const LETTER: Record<FileChangeStatus, string> = { modified: 'M', added: 'A', untracked: 'A', deleted: 'D', renamed: 'R' }
export const TONE: Record<FileChangeStatus, string> = {
  modified: 'text-warning', added: 'text-success', untracked: 'text-success', deleted: 'text-danger line-through', renamed: 'text-accent'
}

/** Does this folder (relative path, "" for the root) hold a change? */
export const holdsChange = (states: GitStates, dir: string) => Object.keys(states).some(p => (dir ? p.startsWith(`${dir}/`) : true))

export function GitLetter({ status }: { status: FileChangeStatus }) {
  const { t } = useI18n()
  return (
    <span title={t.files.gitStatus[status]} aria-label={t.files.gitStatus[status]}
      className={cn('ml-auto shrink-0 pl-2 font-mono text-[10.5px] font-semibold no-underline', TONE[status].replace('line-through', ''))}>
      {LETTER[status]}
    </span>
  )
}

/** The changed files as a tree of their own, every folder open ("Modified only") */
export interface ChangedNode { name: string; path: string; status?: FileChangeStatus; children: ChangedNode[] }

export function changedTree(states: GitStates): ChangedNode[] {
  const root: ChangedNode = { name: '', path: '', children: [] }
  for (const [path, status] of Object.entries(states).sort(([a], [b]) => a.localeCompare(b))) {
    const parts = path.split('/')
    let node = root
    parts.forEach((part, i) => {
      const sub = parts.slice(0, i + 1).join('/')
      let next = node.children.find(c => c.path === sub)
      if (!next) { next = { name: part, path: sub, children: [], ...(i === parts.length - 1 ? { status } : {}) }; node.children.push(next) }
      node = next
    })
  }
  // Folders first
  const sort = (n: ChangedNode) => { n.children.sort((a, b) => Number(!!a.status) - Number(!!b.status) || a.name.localeCompare(b.name)); n.children.forEach(sort) }
  sort(root)
  return root.children
}

/** A file's changes: old and new line numbers, additions in green, removals in red */
export function DiffView({ root, rel }: { root: string; rel: string }) {
  const { t } = useI18n()
  const f = t.files
  const [diff, setDiff] = useState<ParsedDiff | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let alive = true
    setDiff(null)
    setError(false)
    window.devforge.git.fileDiff(root, rel).then(r => { if (alive) setDiff(parseUnifiedDiff(r.diff)) }).catch(() => { if (alive) setError(true) })
    return () => { alive = false }
  }, [root, rel])
  if (error) return <p className="p-4 text-sm text-fg-muted">{f.unreadable}</p>
  if (!diff) return <Spinner className="m-6" />
  if (diff.binary) return <p className="p-4 text-sm text-fg-muted">{f.diffBinary}</p>
  if (!diff.hunks.length) return <p className="p-4 text-sm text-fg-muted">{f.diffNone}</p>
  return (
    <div className="min-w-max py-2 font-mono text-xs leading-relaxed" data-testid="diff-view">
      {diff.hunks.map((h, i) => (
        <div key={i}>
          <div className="px-3 py-1 text-fg-muted">{h.header}</div>
          {h.lines.map((l, j) => (
            <div key={j} data-kind={l.kind}
              className={cn('flex whitespace-pre', l.kind === 'add' && 'bg-success-soft text-fg', l.kind === 'del' && 'bg-danger-soft text-fg', l.kind === 'context' && 'text-fg-secondary')}>
              <span className="w-10 shrink-0 pr-2 text-right text-fg-muted select-none">{l.oldNo ?? ''}</span>
              <span className="w-10 shrink-0 pr-2 text-right text-fg-muted select-none">{l.newNo ?? ''}</span>
              <span className={cn('w-4 shrink-0 select-none', l.kind === 'add' && 'text-success', l.kind === 'del' && 'text-danger')}>{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
              <span className="pr-4">{l.text}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export const diffCounts = (d: ParsedDiff) => ({ added: d.added, removed: d.removed })
