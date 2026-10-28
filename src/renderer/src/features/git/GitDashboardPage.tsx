import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, CloudDownload, Code2, GitBranch, GitCommitHorizontal, RefreshCw, Terminal } from 'lucide-react'
import type { Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import { useGitRepos, type RepoRow } from './useGitRepos'
import { usePreferredIde } from '@renderer/lib/ide'
import CommitModal from './CommitModal'

type Filter = 'attention' | 'all'

const needsAttention = (r: RepoRow) =>
  !!r.details?.isRepo && (r.details.changes > 0 || r.details.ahead > 0 || r.details.behind > 0)

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card className="flex flex-col gap-1 px-4 py-3">
      <span className={cn('text-2xl font-semibold', tone ?? 'text-fg')}>{value}</span>
      <span className="text-sm text-fg-secondary">{label}</span>
    </Card>
  )
}

export default function GitDashboardPage() {
  const { t, lang } = useI18n()
  const ide = usePreferredIde()
  const g = t.gitDash
  const toast = useToast()
  const navigate = useNavigate()
  const { rows, loading, reload, runAction, fetchAll, refreshOne } = useGitRepos()
  const [committing, setCommitting] = useState<{ project: Project; canPush: boolean } | null>(null)
  const [filter, setFilter] = useState<Filter>('attention')
  const [fetchingAll, setFetchingAll] = useState(false)

  const repos     = rows.filter(r => r.details?.isRepo)
  const attention = repos.filter(needsAttention)
  const visible   = (filter === 'attention' ? attention : repos)
    .sort((a, b) => a.project.name.localeCompare(b.project.name))

  async function act(row: RepoRow, kind: 'fetch' | 'pull' | 'push') {
    const r = await runAction(row.project, kind)
    toast.show({
      tone: r.ok ? 'success' : 'error',
      title: `${row.project.name} — ${r.ok ? g.actionDone[kind] : g.actionFailed[kind]}`,
      description: r.ok ? undefined : r.output
    })
  }

  async function handleFetchAll() {
    setFetchingAll(true)
    await fetchAll(repos.map(r => r.project))
    setFetchingAll(false)
    toast.show({ tone: 'success', title: g.fetchAllDone })
  }

  return (
    <Page>
      <PageHeader
        icon={<GitBranch size={18} />}
        title={g.title}
        subtitle={g.subtitle}
        actions={
          <>
            <Button variant="secondary" onClick={reload} loading={loading}>
              {!loading && <RefreshCw size={14} />} {g.refresh}
            </Button>
            <Button onClick={handleFetchAll} loading={fetchingAll} disabled={repos.length === 0}>
              {!fetchingAll && <CloudDownload size={14} />} {g.fetchAll}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3">
        <Stat label={g.statRepos}   value={repos.length} />
        <Stat label={g.statChanges} value={repos.filter(r => r.details!.changes > 0).length} tone="text-warning" />
        <Stat label={g.statAhead}   value={repos.filter(r => r.details!.ahead > 0).length}   tone="text-accent" />
        <Stat label={g.statBehind}  value={repos.filter(r => r.details!.behind > 0).length}  tone="text-danger" />
      </div>

      <Tabs<Filter>
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'attention', label: `${g.filterAttention} (${attention.length})` },
          { value: 'all',       label: `${g.filterAll} (${repos.length})` }
        ]}
      />

      {!loading && visible.length === 0 ? (
        <EmptyState
          icon={<GitBranch size={32} />}
          title={filter === 'attention' ? g.allClean : g.noRepos}
          description={filter === 'attention' ? g.allCleanHint : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map(row => {
            const d = row.details!
            return (
              <Card key={row.project.id} className="flex items-center gap-4 px-4 py-3">
                <ProjectIcon framework={row.project.framework} />

                <button className="flex min-w-0 flex-1 flex-col items-start text-left" onClick={() => navigate(`/project/${row.project.id}`)}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-fg hover:text-accent">{row.project.name}</span>
                    <span className="inline-flex items-center gap-1 rounded bg-elevated px-1.5 py-px font-mono text-2xs text-fg-secondary">
                      <GitBranch size={10} /> {d.branch}
                    </span>
                  </span>
                  {d.lastCommit && (
                    <span className="flex w-full items-center gap-1.5 truncate text-xs text-fg-muted">
                      <GitCommitHorizontal size={12} className="shrink-0" />
                      <span className="truncate">{d.lastCommit.message}</span>
                      <span className="shrink-0">· {formatRelative(d.lastCommit.date, lang)}</span>
                    </span>
                  )}
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  {d.changes > 0 && <Badge color="warning">{d.changes} {g.changes}</Badge>}
                  {d.ahead > 0  && <Badge color="accent"><ArrowUp size={11} /> {d.ahead}</Badge>}
                  {d.behind > 0 && <Badge color="danger"><ArrowDown size={11} /> {d.behind}</Badge>}
                  {!d.hasUpstream && d.remoteUrl && <Badge>{g.noUpstream}</Badge>}
                  {!d.remoteUrl && <Badge>{g.noRemote}</Badge>}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="sm" disabled={d.changes === 0} onClick={() => setCommitting({ project: row.project, canPush: !!d.remoteUrl })}>
                    <GitCommitHorizontal size={13} /> {g.commit}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={!d.remoteUrl} loading={row.busy === 'fetch'} onClick={() => act(row, 'fetch')}>
                    {g.fetch}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={d.behind === 0} loading={row.busy === 'pull'} onClick={() => act(row, 'pull')}>
                    {row.busy !== 'pull' && <ArrowDown size={13} />} {g.pull}
                  </Button>
                  <Button variant="secondary" size="sm" disabled={d.ahead === 0 && d.hasUpstream} loading={row.busy === 'push'} onClick={() => act(row, 'push')}>
                    {row.busy !== 'push' && <ArrowUp size={13} />} {g.push}
                  </Button>
                  {ide.labelFor(row.project.ide) && <IconButton title={ide.labelFor(row.project.ide)!} onClick={() => ide.open(row.project.path, row.project.ide)}><Code2 size={14} /></IconButton>}
                  <IconButton title="Terminal" onClick={() => window.devforge.openTerminal(row.project.path)}><Terminal size={14} /></IconButton>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {committing && (
        <CommitModal
          project={committing.project}
          canPush={committing.canPush}
          onClose={() => setCommitting(null)}
          onDone={() => { refreshOne(committing.project); setCommitting(null) }}
        />
      )}

      {rows.length > repos.length && !loading && (
        <p className="text-sm text-fg-muted">{g.notRepos.replace('{n}', String(rows.length - repos.length))}</p>
      )}
    </Page>
  )
}
