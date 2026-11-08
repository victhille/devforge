import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, Code2, GitBranch, Star, Terminal, Trash2 } from 'lucide-react'
import type { GitStatus, Project, SubProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Button from '@renderer/components/ui/Button'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import ProjectIcon from './ProjectIcon'
import ScriptsMenu from './ScriptsMenu'
import { CiDot, TasksChip, useGitLine } from './ProjectCard'
import MoreMenu, { type MoreItem } from './MoreMenu'
import type { PreferredIde } from '@renderer/lib/ide'

const OPEN_KEY = 'projects-groups-unfolded'

/** Groups the user unfolded (folded by default, as in the mock-up) */
function readUnfolded(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

function writeUnfolded(ids: Set<string>): void {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify([...ids])) } catch { /* ignore */ }
}

interface Props {
  project: Project
  gitStatus?: GitStatus | null
  /** The IDEs: the group's own, each project's own, else the default */
  ide: PreferredIde
  onTerminal: (path: string) => void
  onRunScript: (sub: SubProject, script: string) => void
  onToggleFavorite: () => void
  onDetail: () => void
  onRemove?: () => void
  index?: number
  /** The name of its projects folder, shown when there are several */
  folder?: string | null
  /** v3.8: its open tasks, and the way to them */
  openTasks?: number
  onOpenTasks?: () => void
  /** v3.8: its GitHub workflows failing now */
  ciFailing?: string[]
}

/** A chip of the folded card: a project of the group, or something else in its folder */
const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex h-6.5 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-sm text-fg-secondary">{children}</span>
)

/** One project of the group: its stack, its Git state, its own IDE, terminal and scripts */
function SubRow({ sub, ideLabel, onOpenIde, onTerminal, onRunScript }: { sub: SubProject; ideLabel: string | null; onOpenIde: (path: string) => void } & Pick<Props, 'onTerminal'> & { onRunScript: (s: string) => void }) {
  const { t } = useI18n()
  const [git, setGit] = useState<GitStatus | null>(null)
  const [scripts, setScripts] = useState<Record<string, string>>({})
  useEffect(() => {
    window.devforge.getGitStatus(sub.path).then(setGit).catch(() => setGit(null))
    window.devforge.getProjectScripts(sub.path).then(setScripts).catch(() => setScripts({}))
  }, [sub.path])
  const state = !git?.branch ? null
    : git.ahead > 0 ? { text: `↑ ${git.ahead}`, color: 'text-accent' }
    : git.dirty ? { text: t.projects.uncommitted, color: 'text-warning' }
    : { text: t.home.upToDate, color: 'text-success' }
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle bg-canvas/40 px-3 py-2.5 first:border-t-0">
      <ProjectIcon framework={sub.framework} size="sm" />
      <div className="min-w-[140px] flex-1">
        <div className="truncate text-base font-semibold text-fg" title={sub.path}>{sub.name}</div>
        <div className="truncate font-mono text-xs text-fg-muted">
          {FRAMEWORK_LABEL[sub.framework] ?? sub.framework}
          {git?.branch && <> · {git.branch} {state && <span className={state.color}>{state.text}</span>}</>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {ideLabel && <Button size="sm" variant="secondary" onClick={() => onOpenIde(sub.path)}>{ideLabel}</Button>}
        <IconButton size="sm" title={t.projects.terminal} onClick={() => onTerminal(sub.path)}><Terminal size={13} /></IconButton>
        <ScriptsMenu scripts={scripts} onRun={onRunScript} />
      </div>
    </div>
  )
}

/** v3.5: a folder holding several projects (back + front): folded, its projects as chips; unfolded, each with its actions */
export default function GroupCard(props: Props) {
  const { project, gitStatus, ide, onTerminal, onRunScript, onToggleFavorite, onDetail, onRemove, index = 0, folder, openTasks, onOpenTasks, ciFailing } = props
  const { t } = useI18n()
  const subs = project.subprojects ?? []
  const extras = project.extras ?? []
  const [folded, setFolded] = useState(() => !readUnfolded().has(project.id))
  function toggle() {
    const all = readUnfolded()
    if (folded) all.add(project.id)
    else all.delete(project.id)
    writeUnfolded(all)
    setFolded(!folded)
  }
  // A project of the group: its own IDE, else the group's
  const subIde = (sub: SubProject) => project.subIdes?.[sub.name] ?? project.ide
  const ideLabel = ide.labelFor(project.ide)
  const git = useGitLine(gitStatus)
  const count = t.projects.groupProjects.replace('{n}', String(subs.length)).replace('{s}', subs.length > 1 ? 's' : '')
  const more: MoreItem[] = [
    ...(ideLabel ? [{ label: t.projects.groupIde.replace('{ide}', ideLabel), icon: Code2, onSelect: () => ide.open(project.path, project.ide) }] : []),
    { label: t.projects.terminal, icon: Terminal, onSelect: () => onTerminal(project.path) },
    ...(onRemove ? [{ label: t.hub.remove, icon: Trash2, danger: true, onSelect: onRemove }] : [])
  ]

  return (
    // Like a project's card: a click opens its page, except on its own buttons and menus
    <Card interactive onClick={e => { if (!(e.target as Element).closest('button, a, input, select, [role="menu"]')) onDetail() }}
      className={cn('df-rise flex flex-col gap-3.5 rounded-card p-4.5', !folded && 'border-accent/40 xl:col-span-2')} style={{ '--i': index } as CSSProperties}>
      <div className="flex items-start gap-2.5">
        <ProjectIcon framework="group" />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 truncate text-md font-semibold text-fg">{project.name}<CiDot failing={ciFailing} /></h2>
          <div className="truncate font-mono text-xs text-fg-muted" title={project.path}>{project.path} · {t.projects.groupWord}</div>
        </div>
        <IconButton size="sm" title={t.projects.favorite} aria-pressed={project.favorite} onClick={onToggleFavorite} className={cn(project.favorite && 'text-accent hover:text-accent')}>
          <Star size={13} fill={project.favorite ? 'currentColor' : 'none'} />
        </IconButton>
        <IconButton size="sm" title={folded ? t.projects.groupUnfold : t.projects.groupFold} aria-expanded={!folded} onClick={toggle}>
          {folded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </IconButton>
      </div>
      {/* As in the mock-up: its projects as chips, then what else is in the folder */}
      {folded && (
        <div className="flex flex-wrap items-center gap-1.5" title={extras.length ? `${t.projects.groupExtras} ${extras.join(', ')}` : undefined}>
          {subs.map(s => <Chip key={s.path}><ProjectIcon framework={s.framework} size="xs" />{s.name}</Chip>)}
          {extras.slice(0, 2).map(x => <Chip key={x}>{x}</Chip>)}
          {extras.length > 2 && <span className="text-xs text-fg-muted">{t.projects.groupMore.replace('{n}', String(extras.length - 2)).replace('{s}', extras.length - 2 > 1 ? 's' : '')}</span>}
          {/* The whole folder for a screen reader (the title is for the mouse) */}
          {extras.length > 2 && <span className="sr-only">{t.projects.groupExtras} {extras.join(', ')}</span>}
        </div>
      )}
      {(folder || !!openTasks) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {folder && <span className="text-xs text-fg-muted">{folder}</span>}
          <TasksChip count={openTasks} onClick={onOpenTasks} />
        </div>
      )}
      {project.missing && <div className="text-xs font-medium text-warning">{t.hub.missing}</div>}
      <p className="flex min-w-0 items-center gap-1.5 text-sm text-fg-secondary">
        {git && <><GitBranch size={13} aria-hidden className="shrink-0" /><span className="font-mono">{gitStatus!.branch}</span><span className={git.color}>{git.text}</span><span className="text-fg-muted">·</span></>}
        <span className="text-fg-muted">{count}</span>
      </p>
      {!folded && subs.length > 0 && (
          <>
            <div className="overflow-hidden rounded-control border border-line">
              {subs.map(sub => (
                <SubRow key={sub.path} sub={sub} ideLabel={ide.labelFor(subIde(sub))} onOpenIde={path => ide.open(path, subIde(sub))} onTerminal={onTerminal} onRunScript={s => onRunScript(sub, s)} />
              ))}
            </div>
            {/* The rest of the folder: docs, infra, README… part of the group too */}
            {extras.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5" data-testid="group-extras">
                <span className="text-xs text-fg-muted">{t.projects.groupExtras}</span>
                {extras.slice(0, 8).map(x => <span key={x} className="rounded-md bg-elevated px-1.5 py-0.5 font-mono text-xs text-fg-secondary">{x}</span>)}
                {extras.length > 8 && <span className="font-mono text-xs text-fg-muted">+{extras.length - 8}</span>}
              </div>
            )}
          </>
        )}
      <div className="mt-auto flex items-center gap-1.5">
        <Button size="sm" variant="secondary" className="min-w-0 flex-1 truncate" onClick={onDetail}>{t.projects.groupOpen}</Button>
        <MoreMenu size="sm" label={t.hub.moreActions} items={more} />
      </div>
    </Card>
  )
}
