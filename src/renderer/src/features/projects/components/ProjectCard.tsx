import { Code2, FolderOpen, Plus, Star, Terminal, Trash2 } from 'lucide-react'
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

// ─── Saved project ────────────────────────────────────────────────────────────

interface SavedProps {
  project: Project
  layout: CardLayout
  gitStatus?: GitStatus | null
  scripts?: Record<string, string>
  onOpen: () => void
  onOpenVSCode: () => void
  onTerminal: () => void
  onToggleFavorite: () => void
  onDetail: () => void
  onRemove?: () => void
  onRunScript?: (script: string) => void
}

export function ProjectCard(props: SavedProps) {
  const { project, layout, gitStatus, scripts = {}, onOpen, onOpenVSCode, onTerminal, onToggleFavorite, onDetail, onRemove, onRunScript } = props
  const { t } = useI18n()
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework

  if (layout === 'grid') {
    return (
      <Card interactive onClick={onDetail} className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between">
          <ProjectIcon framework={project.framework} size="lg" />
          <div className="flex items-center gap-1">
            <Badge>{label}</Badge>
            <FavoriteButton active={project.favorite} onClick={onToggleFavorite} title={t.projects.favorite} />
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-md font-semibold text-fg">{project.name}</span>
          <span className="truncate font-mono text-xs text-fg-muted">{project.path}</span>
          <div><GitBadge status={gitStatus} /></div>
        </div>
        <div className="mt-auto flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <Button variant="secondary" size="sm" className="flex-1" onClick={onOpen}>{t.projects.open}</Button>
          <IconButton title={t.projects.vsCode} onClick={onOpenVSCode}><Code2 size={13} /></IconButton>
          <IconButton title={t.projects.terminal} onClick={onTerminal}><Terminal size={13} /></IconButton>
          {onRunScript && <ScriptsMenu scripts={scripts} onRun={onRunScript} />}
          {onRemove && <IconButton tone="danger" title={t.projects.remove} onClick={onRemove}><Trash2 size={13} /></IconButton>}
        </div>
      </Card>
    )
  }

  return (
    <Card className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:border-line">
      <FavoriteButton active={project.favorite} onClick={onToggleFavorite} title={t.projects.favorite} />
      <ProjectIcon framework={project.framework} />
      <button onClick={onDetail} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="truncate font-medium text-fg group-hover:text-accent">{project.name}</span>
        <span className="flex w-full items-center gap-2 truncate font-mono text-xs text-fg-muted">
          <span className="truncate">{project.path}</span>
          <GitBadge status={gitStatus} />
        </span>
      </button>
      <Badge>{label}</Badge>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton title={t.projects.terminal} onClick={onTerminal}><Terminal size={13} /></IconButton>
        {onRunScript && <ScriptsMenu scripts={scripts} onRun={onRunScript} />}
        <Button variant="ghost" size="sm" onClick={onOpenVSCode}><Code2 size={13} /> {t.projects.vsCode}</Button>
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
}

export function DetectedProjectCard({ project, layout, onImport, onOpen, onTerminal }: DetectedProps) {
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
          <Badge>{label}</Badge>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-md font-semibold text-fg">{project.name}</span>
          <span className="truncate font-mono text-xs text-fg-muted">{project.path}</span>
        </div>
        <div className="mt-auto flex items-center gap-1">
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
      </div>
      <Badge>{label}</Badge>
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        <Button variant="secondary" size="sm" onClick={onImport}><Plus size={12} /> {t.projects.import}</Button>
      </div>
    </Card>
  )
}
