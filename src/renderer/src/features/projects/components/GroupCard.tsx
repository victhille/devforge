import { useEffect, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp, Star, Terminal, Trash2 } from 'lucide-react'
import type { GitStatus, Project, SubProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import ProjectIcon from './ProjectIcon'
import ScriptsMenu from './ScriptsMenu'

const OPEN_KEY = 'projects-groups-folded'

/** Groups the user folded (unfolded by default) */
function readFolded(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]') as string[]) } catch { return new Set() }
}

function writeFolded(ids: Set<string>): void {
  try { localStorage.setItem(OPEN_KEY, JSON.stringify([...ids])) } catch { /* ignore */ }
}

interface Props {
  project: Project
  gitStatus?: GitStatus | null
  /** The chosen IDE's name; null: no IDE, no button */
  ideLabel: string | null
  onOpenIde: (path: string) => void
  onTerminal: (path: string) => void
  onRunScript: (sub: SubProject, script: string) => void
  onToggleFavorite: () => void
  onDetail: () => void
  onRemove?: () => void
  index?: number
  /** The name of its projects folder, shown when there are several */
  folder?: string | null
}

/** One project of the group: its stack, its Git state, its own IDE, terminal and scripts */
function SubRow({ sub, ideLabel, onOpenIde, onTerminal, onRunScript }: { sub: SubProject } & Pick<Props, 'ideLabel' | 'onOpenIde' | 'onTerminal'> & { onRunScript: (s: string) => void }) {
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
        <div className="truncate text-[13.5px] font-semibold text-fg" title={sub.path}>{sub.name}</div>
        <div className="truncate font-mono text-[11.5px] text-fg-muted">
          {FRAMEWORK_LABEL[sub.framework] ?? sub.framework}
          {git?.branch && <> · {git.branch} {state && <span className={state.color}>{state.text}</span>}</>}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {ideLabel && <button onClick={() => onOpenIde(sub.path)} className="h-[30px] rounded-lg border border-line bg-elevated px-2.5 text-xs font-medium text-fg hover:bg-hover">{ideLabel}</button>}
        <IconButton size="sm" title={t.projects.terminal} onClick={() => onTerminal(sub.path)}><Terminal size={13} /></IconButton>
        <ScriptsMenu scripts={scripts} onRun={onRunScript} />
      </div>
    </div>
  )
}

/** v3.5: a folder holding several projects (back + front), unfolded on its card */
export default function GroupCard(props: Props) {
  const { project, gitStatus, ideLabel, onOpenIde, onTerminal, onRunScript, onToggleFavorite, onDetail, onRemove, index = 0, folder } = props
  const { t } = useI18n()
  const subs = project.subprojects ?? []
  const [folded, setFolded] = useState(() => readFolded().has(project.id))
  function toggle() {
    const all = readFolded()
    if (folded) all.delete(project.id)
    else all.add(project.id)
    writeFolded(all)
    setFolded(!folded)
  }
  const stacks = [...new Set(subs.map(s => FRAMEWORK_LABEL[s.framework] ?? s.framework))]
  const action = 'h-8 flex-1 rounded-lg border text-[12.5px] font-medium transition-colors'

  return (
    <Card className={cn('df-rise flex flex-col gap-3 rounded-[14px] p-[18px]', !folded && 'border-accent/40 xl:col-span-2')} style={{ '--i': index } as CSSProperties}>
      <div className="flex items-center gap-3">
        <ProjectIcon framework="group" size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold text-fg">{project.name}</h2>
          <div className="truncate font-mono text-[11.5px] text-fg-muted" title={project.path}>{project.path}</div>
        </div>
        <IconButton title={t.projects.favorite} onClick={onToggleFavorite} className={cn(project.favorite && 'text-warning hover:text-warning')}>
          <Star size={13} fill={project.favorite ? 'currentColor' : 'none'} />
        </IconButton>
        <IconButton title={folded ? t.projects.groupUnfold : t.projects.groupFold} aria-expanded={!folded} onClick={toggle}>
          {folded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[11px] text-accent">{t.projects.groupCount.replace('{n}', String(subs.length))}</span>
        {stacks.map(s => <span key={s} className="rounded-md border border-line bg-elevated px-2 py-0.5 font-mono text-[11px] text-fg-secondary">{s}</span>)}
        {folder && <span className="px-1.5 text-[11px] text-fg-muted">{folder}</span>}
      </div>
      {project.missing && <div className="text-xs font-medium text-warning">{t.hub.missing}</div>}
      {folded
        ? <div className="truncate font-mono text-xs text-fg-secondary">{subs.map(s => s.name).join(' · ')}{gitStatus?.branch && <span className="text-fg-muted"> · {gitStatus.branch}</span>}</div>
        : subs.length > 0 && (
          <div className="overflow-hidden rounded-[10px] border border-line">
            {subs.map(sub => (
              <SubRow key={sub.path} sub={sub} ideLabel={ideLabel} onOpenIde={onOpenIde} onTerminal={onTerminal} onRunScript={s => onRunScript(sub, s)} />
            ))}
          </div>
        )}
      <div className="mt-auto flex items-center gap-1.5">
        {ideLabel && <button onClick={() => onOpenIde(project.path)} className={cn(action, 'border-line bg-elevated text-fg hover:bg-hover')}>{t.projects.groupIde.replace('{ide}', ideLabel)}</button>}
        <button onClick={() => onTerminal(project.path)} className={cn(action, 'border-line bg-elevated text-fg hover:bg-hover')}>{t.projects.terminal}</button>
        <button onClick={onDetail} className={cn(action, 'border-transparent bg-accent-soft font-semibold text-accent hover:bg-accent hover:text-accent-fg')}>{t.projects.groupOpen}</button>
        {onRemove && <IconButton tone="danger" title={t.projects.remove} onClick={onRemove}><Trash2 size={13} /></IconButton>}
      </div>
    </Card>
  )
}
