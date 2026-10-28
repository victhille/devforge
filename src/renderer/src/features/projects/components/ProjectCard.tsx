import type { CSSProperties } from 'react'
import { ListTodo, Code2, Folder, FolderOpen, GitBranch, Plus, Star, Terminal, Trash2 } from 'lucide-react'
import type { DetectedProject, GitStatus, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import ProjectIcon from './ProjectIcon'
import GitBadge from './GitBadge'
import ScriptsMenu from './ScriptsMenu'

export type CardLayout = 'list' | 'grid'

/** The projects folder a project comes from, when there are several */
function FolderTag({ name }: { name?: string | null }) {
  if (!name) return null
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-fg-muted" title={name}>
      <Folder size={11} aria-hidden /> {name}
    </span>
  )
}

/** A detected group's projects, with their stack */
function SubNames({ project }: { project: DetectedProject }) {
  const { t } = useI18n()
  if (!project.subprojects?.length) return null
  return (
    <span className="truncate text-xs text-fg-secondary">
      {t.projects.groupCount.replace('{n}', String(project.subprojects.length))} · {project.subprojects.map(s => `${s.name} (${FRAMEWORK_LABEL[s.framework] ?? s.framework})`).join(', ')}
    </span>
  )
}

function FavoriteButton({ active, onClick, title }: { active: boolean; onClick: () => void; title: string }) {
  return (
    <IconButton
      title={title}
      onClick={e => { e.stopPropagation(); onClick() }}
      className={cn(active && 'text-warning hover:text-warning')}
    >
      <Star size={13} fill={active ? 'currentColor' : 'none'} />
    </IconButton>
  )
}

/** v3.8: the project's open tasks; a click opens its Notes tab */
export function TasksChip({ count, onClick }: { count?: number; onClick?: () => void }) {
  const { t } = useI18n()
  if (!count) return null
  return (
    <button onClick={e => { e.stopPropagation(); onClick?.() }} data-testid="tasks-chip"
      className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning-soft px-2 py-0.5 font-mono text-[11px] text-warning hover:border-warning">
      <ListTodo size={11} aria-hidden /> {t.notes.toDo.replace('{n}', String(count))}
    </button>
  )
}

// ─── Saved project ────────────────────────────────────────────────────────────

interface SavedProps {
  project: Project
  layout: CardLayout
  gitStatus?: GitStatus | null
  scripts?: Record<string, string>
  onOpen: () => void
  onOpenVSCode: () => void
  /** The chosen IDE's name; null: no IDE, no button */
  ideLabel: string | null
  onTerminal: () => void
  onToggleFavorite: () => void
  onDetail: () => void
  onRemove?: () => void
  onRunScript?: (script: string) => void
  /** Position in the list, to stagger the entrance */
  index?: number
  /** v3.5: the name of its projects folder, shown when there are several */
  folder?: string | null
  /** v3.8: its open tasks, and the way to them */
  openTasks?: number
  onOpenTasks?: () => void
}

export function ProjectCard(props: SavedProps) {
  const { project, layout, gitStatus, scripts = {}, ideLabel, onOpen, onOpenVSCode, onTerminal, onToggleFavorite, onDetail, onRemove, onRunScript, index = 0, folder, openTasks, onOpenTasks } = props
  const { t } = useI18n()
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework

  if (layout === 'grid') {
    const git = !gitStatus?.branch ? null
      : gitStatus.ahead > 0 ? { text: `↑ ${gitStatus.ahead}`, color: 'text-accent' }
      : gitStatus.dirty ? { text: t.projects.uncommitted, color: 'text-warning' }
      : { text: t.home.upToDate, color: 'text-success' }
    const action = 'h-8 rounded-lg border text-[12.5px] font-medium transition-colors'
    return (
      <Card interactive onClick={onDetail} className="df-rise group flex flex-col gap-3 rounded-[14px] p-[18px]" style={{ '--i': index } as CSSProperties}>
        <div className="flex items-center gap-3">
          <ProjectIcon framework={project.framework} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-fg">{project.name}</h2>
            <div className="truncate font-mono text-[11.5px] text-fg-muted" title={project.path}>{project.path}</div>
          </div>
          <FavoriteButton active={project.favorite} onClick={onToggleFavorite} title={t.projects.favorite} />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[label, project.packageManager].filter(Boolean).map(tag => (
            <span key={tag} className="rounded-md border border-line bg-elevated px-2 py-0.5 font-mono text-[11px] text-fg-secondary">{tag}</span>
          ))}
          <FolderTag name={folder} />
          <TasksChip count={openTasks} onClick={onOpenTasks} />
        </div>
        {project.missing && <div className="text-xs font-medium text-warning">{t.hub.missing}</div>}
        {git && (
          <div className="flex items-center gap-2 font-mono text-xs text-fg-secondary">
            <GitBranch size={14} /> {gitStatus!.branch} <span className={git.color}>{git.text}</span>
          </div>
        )}
        <div className="mt-auto flex items-center gap-1.5 opacity-60 transition-opacity group-hover:opacity-100" onClick={e => e.stopPropagation()}>
          {ideLabel && <button onClick={onOpenVSCode} className={cn(action, 'flex-1 border-line bg-elevated text-fg hover:bg-hover')}>{ideLabel}</button>}
          <button onClick={onTerminal} className={cn(action, 'flex-1 border-line bg-elevated text-fg hover:bg-hover')}>{t.projects.terminal}</button>
          <button onClick={onOpen} className={cn(action, 'flex-1 border-transparent bg-accent-soft font-semibold text-accent hover:bg-accent hover:text-accent-fg')}>{t.projects.open}</button>
          {onRunScript && <ScriptsMenu scripts={scripts} onRun={onRunScript} />}
          {onRemove && <IconButton tone="danger" title={t.projects.remove} onClick={onRemove}><Trash2 size={13} /></IconButton>}
        </div>
      </Card>
    )
  }

  return (
    <Card className="group flex items-center gap-3 px-4 py-3 transition-colors hover:border-line">
      <FavoriteButton active={project.favorite} onClick={onToggleFavorite} title={t.projects.favorite} />
      <ProjectIcon framework={project.framework} />
      <button onClick={onDetail} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="truncate font-medium text-fg group-hover:text-accent">{project.name}</span>
        <span className="flex w-full items-center gap-2 truncate font-mono text-xs text-fg-muted">
          <span className="truncate">{project.path}</span>
          <GitBadge status={gitStatus} />
        </span>
      </button>
      <TasksChip count={openTasks} onClick={onOpenTasks} />
      {project.missing && <span className="shrink-0 text-xs font-medium text-warning">{t.hub.missing}</span>}
      <FolderTag name={folder} />
      <Badge>{label}</Badge>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton title={t.projects.terminal} onClick={onTerminal}><Terminal size={13} /></IconButton>
        {onRunScript && <ScriptsMenu scripts={scripts} onRun={onRunScript} />}
        {ideLabel && <Button variant="ghost" size="sm" onClick={onOpenVSCode}><Code2 size={13} /> {ideLabel}</Button>}
        <Button variant="secondary" size="sm" onClick={onOpen}>{t.projects.open}</Button>
        {onRemove && <IconButton tone="danger" title={t.projects.remove} onClick={onRemove}><Trash2 size={13} /></IconButton>}
      </div>
    </Card>
  )
}

// ─── Detected (not yet imported) project ──────────────────────────────────────

interface DetectedProps {
  project: DetectedProject
  layout: CardLayout
  onImport: () => void
  onOpen: () => void
  onTerminal: () => void
  /** v3.5: the name of its projects folder, shown when there are several */
  folder?: string | null
}

export function DetectedProjectCard({ project, layout, onImport, onOpen, onTerminal, folder }: DetectedProps) {
  const { t } = useI18n()
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework

  const actions = (
    <>
      <IconButton title="Open folder" onClick={onOpen}><FolderOpen size={13} /></IconButton>
      <IconButton title={t.projects.terminal} onClick={onTerminal}><Terminal size={13} /></IconButton>
    </>
  )

  if (layout === 'grid') {
    return (
      <Card className="flex flex-col gap-3 border-dashed p-4">
        <div className="flex items-start justify-between">
          <ProjectIcon framework={project.framework} size="lg" />
          <div className="flex items-center gap-1"><FolderTag name={folder} /><Badge>{label}</Badge></div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-md font-semibold text-fg">{project.name}</span>
          <span className="truncate font-mono text-xs text-fg-muted">{project.path}</span>
          <SubNames project={project} />
        </div>
        <div className="mt-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" className="flex-1" onClick={onImport}><Plus size={12} /> {t.projects.import}</Button>
          {actions}
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex items-center gap-3 border-dashed px-3 py-2.5">
      <ProjectIcon framework={project.framework} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-fg">{project.name}</span>
        <span className="truncate font-mono text-xs text-fg-muted">{project.path}</span>
        <SubNames project={project} />
      </div>
      <FolderTag name={folder} />
      <Badge>{label}</Badge>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Button variant="secondary" size="sm" onClick={onImport}><Plus size={12} /> {t.projects.import}</Button>
      </div>
    </Card>
  )
}
