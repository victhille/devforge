import { useState, useEffect, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Code2, Terminal, Star, Trash2, GitBranch, Play } from 'lucide-react'
import type { Project, GitStatus, DefaultIDE } from '@shared/types'
import { useConsole } from '@renderer/app/ConsoleContext'
import { cn } from '@renderer/lib/cn'
import { formatDate } from '@renderer/lib/format'
import Card, { CardHeader, CardTitle } from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import FrameworkIcon, { FRAMEWORK_COLOR, FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import ProjectIcon from './components/ProjectIcon'
import GitBadge from './components/GitBadge'
import FileTree from './components/FileTree'

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
      <span className="shrink-0 text-fg-muted">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-fg">{children}</span>
    </div>
  )
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <div className="divide-y divide-line-subtle">{children}</div>
    </Card>
  )
}

export default function ProjectDetailPage() {
  const { id }        = useParams<{ id: string }>()
  const navigate      = useNavigate()
  const { runScript } = useConsole()

  const [project,   setProject]   = useState<Project | null>(null)
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)
  const [scripts,   setScripts]   = useState<Record<string, string>>({})
  const [ide,       setIde]       = useState<DefaultIDE>('vscode')

  useEffect(() => {
    if (!id) return
    window.devforge.getProjects().then(projects => {
      const p = projects.find(x => x.id === id)
      if (!p) { navigate('/projects'); return }
      setProject(p)
      window.devforge.getGitStatus(p.path).then(setGitStatus).catch(() => {})
      window.devforge.getProjectScripts(p.path).then(setScripts).catch(() => {})
    })
    window.devforge.getSettings().then(s => setIde(s.defaultIDE))
  }, [id, navigate])

  if (!project) return <p className="p-8 text-fg-muted">Loading…</p>

  async function toggleFavorite() {
    await window.devforge.toggleFavorite(project!.id)
    setProject(p => (p ? { ...p, favorite: !p.favorite } : p))
  }

  async function remove() {
    if (!window.confirm(`Remove "${project!.name}" from DevForge? (The folder will not be deleted.)`)) return
    await window.devforge.removeProject(project!.id)
    navigate('/projects')
  }

  const color      = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const scriptList = Object.entries(scripts)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-line-subtle bg-surface px-5 py-3">
        <IconButton title="Back" onClick={() => navigate(-1)}><ArrowLeft size={14} /></IconButton>
        <ProjectIcon framework={project.framework} />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h1 className="truncate text-lg font-semibold text-fg">{project.name}</h1>
          <GitBadge status={gitStatus} />
        </div>
        <div className="flex items-center gap-1">
          <IconButton title="Favorite" onClick={toggleFavorite} className={cn(project.favorite && 'text-warning hover:text-warning')}>
            <Star size={14} fill={project.favorite ? 'currentColor' : 'none'} />
          </IconButton>
          <IconButton title="Open in IDE" onClick={() => window.devforge.openInIDE(project.path, ide)}><Code2 size={14} /></IconButton>
          <IconButton title="Open terminal" onClick={() => window.devforge.openTerminal(project.path)}><Terminal size={14} /></IconButton>
          <IconButton title="Remove" tone="danger" onClick={remove}><Trash2 size={14} /></IconButton>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-line-subtle bg-surface">
          <FileTree rootPath={project.path} />
        </aside>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
          <InfoCard title="Project">
            <InfoRow label="Framework">
              <span className="flex items-center gap-1.5" style={{ color }}>
                <FrameworkIcon name={project.framework} size={12} />
                {FRAMEWORK_LABEL[project.framework] ?? project.framework}
              </span>
            </InfoRow>
            <InfoRow label="Package manager">{project.packageManager}</InfoRow>
            <InfoRow label="Created">{formatDate(project.createdAt)}</InfoRow>
            <InfoRow label="Last opened">{formatDate(project.lastOpenedAt)}</InfoRow>
            <InfoRow label="Path">
              <button
                title={project.path}
                onClick={() => window.devforge.openDirectory(project.path)}
                className="truncate font-mono text-xs text-accent hover:underline"
              >
                {project.path}
              </button>
            </InfoRow>
          </InfoCard>

          {gitStatus && (
            <InfoCard title="Git">
              {gitStatus.branch ? (
                <>
                  <InfoRow label="Branch"><GitBranch size={11} /> {gitStatus.branch}</InfoRow>
                  <InfoRow label="Status">
                    <span className={gitStatus.dirty ? 'text-warning' : 'text-success'}>
                      {gitStatus.dirty ? 'Uncommitted changes' : 'Clean'}
                    </span>
                  </InfoRow>
                  {(gitStatus.ahead > 0 || gitStatus.behind > 0) && (
                    <InfoRow label="Sync">
                      {gitStatus.ahead > 0  && <span className="text-success">↑{gitStatus.ahead}</span>}
                      {gitStatus.behind > 0 && <span className="text-warning">↓{gitStatus.behind}</span>}
                    </InfoRow>
                  )}
                </>
              ) : (
                <InfoRow label="Repository"><span className="text-fg-muted">Not initialized</span></InfoRow>
              )}
            </InfoCard>
          )}

          {scriptList.length > 0 && (
            <InfoCard title="Scripts">
              {scriptList.map(([name, cmd]) => (
                <div key={name} className="group flex items-center gap-3 px-4 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium text-fg">{name}</span>
                    <span className="truncate font-mono text-xs text-fg-muted">{cmd}</span>
                  </div>
                  <IconButton
                    title={`Run ${name}`}
                    onClick={() => runScript(project.path, name, project.packageManager, project.name)}
                    className="text-success hover:bg-success-soft hover:text-success"
                  >
                    <Play size={12} />
                  </IconButton>
                </div>
              ))}
            </InfoCard>
          )}
        </div>
      </div>
    </div>
  )
}
