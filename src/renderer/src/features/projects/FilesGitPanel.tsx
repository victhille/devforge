import { useMemo } from 'react'
import { Skeleton } from '@renderer/components/ui/Skeleton'
import { ArrowDown, ArrowUp, GitBranch, RefreshCw } from 'lucide-react'
import type { DefaultIDE, GitRepoDetails, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { formatRelative } from '@renderer/lib/format'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { useCommit } from '@renderer/features/git/useCommit'
import FileTree from './components/FileTree'
import CommitCard from './components/CommitCard'

/**
 * The « Files and Git » tab, as in the mock-up: the branch and its actions above
 * the tree, the file (or its changes) on the right, and the commit under it while
 * something changed. Everything the Git tab did is here: fetch, pull, push,
 * a partial commit, a commit pushed at once.
 */
export default function FilesGitPanel({ project, git, ide, open, busy, rev, onGitAction, onCommitted }: {
  project: Project
  git: GitRepoDetails | null
  ide?: DefaultIDE
  open?: { path: string; line?: number }
  /** The Git action running (fetch, pull, push), if any */
  busy: string | null
  /** Changes on each Git action and commit: the tree and the changes are read again */
  rev: number
  onGitAction: (action: 'pull' | 'push' | 'fetch') => void
  onCommitted: () => void
}) {
  const { t, lang } = useI18n()
  const h = t.hub
  const repo = !!git?.isRepo
  const commit = useCommit(project.path, onCommitted, rev)
  const stats = useMemo(() => Object.fromEntries((commit.changes ?? []).map(c => [c.path, { add: c.insertions, del: c.deletions }])), [commit.changes])

  const header = !git ? <Skeleton className="h-4 w-56" /> : !repo ? <p className="text-sm text-fg-muted">{h.gitNone}</p> : (
    <div className="flex flex-col gap-1 border-b border-line-subtle pb-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <GitBranch size={14} aria-hidden className="shrink-0 text-fg-secondary" />
        <span className="min-w-0 truncate font-mono text-sm font-semibold text-fg">{git.branch}</span>
        <span className="shrink-0 font-mono text-xs text-fg-muted" title={`${h.gitAhead.replace('{n}', String(git.ahead))} · ${h.gitBehind.replace('{n}', String(git.behind))}`}>↑{git.ahead} ↓{git.behind}</span>
        <span className="flex-1" />
        <IconButton size="sm" title={h.fetch} disabled={!git.hasUpstream || !!busy} onClick={() => onGitAction('fetch')}>
          {busy === 'fetch' ? <Spinner /> : <RefreshCw size={13} />}
        </IconButton>
        <IconButton size="sm" title={h.pull} disabled={!git.hasUpstream || !!busy} onClick={() => onGitAction('pull')}>
          {busy === 'pull' ? <Spinner /> : <ArrowDown size={14} />}
        </IconButton>
        <IconButton size="sm" title={h.push} disabled={!git.ahead || !!busy} onClick={() => onGitAction('push')}>
          {busy === 'push' ? <Spinner /> : <ArrowUp size={14} />}
        </IconButton>
      </div>
      {git.lastCommit && <p className="truncate text-xs text-fg-muted" title={git.lastCommit.message}>{git.lastCommit.message} · {formatRelative(git.lastCommit.date, lang)}</p>}
    </div>
  )

  return (
    <FileTree rootPath={project.path} ide={ide ?? project.ide} open={open} rev={rev} stats={stats} header={header}
      below={repo ? <CommitCard commit={commit} canPush={!!git?.hasUpstream} /> : null} />
  )
}
