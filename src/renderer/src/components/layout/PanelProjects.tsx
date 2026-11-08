import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import type { Project } from '@shared/types'

/** Whether the page on screen is this project's (its overview or one of its tabs) */
export const onProject = (pathname: string, id: string) => pathname === `/project/${id}` || pathname.startsWith(`/project/${id}/`)

/** A row of the panel (a page, a Settings section, a project): 34 px, 14 px text; the one on screen on the active background
 *  (the app's rem is 13 px: one spacing unit is 3.25 px) */
export const panelRow = (on: boolean, className?: string) => cn(
  'group/link flex h-10.5 items-center gap-3 rounded-control px-3 text-md transition-colors',
  on ? 'bg-active font-semibold text-fg' : 'text-fg-secondary hover:bg-elevated hover:text-fg',
  className
)

/** The icons of the panel's rows */
export const PANEL_ICON = 17

/** A heading of the menu's panel (Favorites, Recent projects…) */
export function PanelLabel({ children }: { children: ReactNode }) {
  return <span className="truncate text-sm font-semibold tracking-wide text-fg-muted">{children}</span>
}

/** A listed project's changed files, null when its folder is not a Git repository; missing while it is read */
type RepoState = { changes: number } | null

/**
 * The state of the repository of the projects the panel lists. Read when they show,
 * then again on each page change and when the window comes back to the front
 * (the main process keeps it ten seconds, so this stays cheap)
 */
function useRepoStates(projects: Project[]) {
  const { pathname } = useLocation()
  const [states, setStates] = useState<Record<string, RepoState>>({})
  const [focus, setFocus] = useState(0)
  useEffect(() => {
    const onFocus = () => setFocus(n => n + 1)
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])
  // Read again when the listed projects change, not on each render
  const listed = JSON.stringify(projects.map(p => [p.id, p.path]))
  useEffect(() => {
    let alive = true
    const pairs = JSON.parse(listed) as [string, string][]
    Promise.all(pairs.map(async ([id, path]) => {
      try {
        const d = await window.devforge.git.details(path)
        return [id, d.isRepo ? { changes: d.changes } : null] as const
      } catch { return null }
    })).then(read => {
      // A project whose state could not be read keeps the last one known
      if (alive) setStates(s => ({ ...s, ...Object.fromEntries(read.filter(x => x !== null)) }))
    })
    return () => { alive = false }
  }, [listed, pathname, focus])
  return states
}

/** A project of the panel: a dot for its repository (orange: changed files, green: up to date), its name, its number of changed files */
function ProjectLink({ project, state }: { project: Project; state: RepoState | undefined }) {
  const { t } = useI18n()
  const { pathname } = useLocation()
  const on = onProject(pathname, project.id)
  const changes = state?.changes ?? 0
  const status = state === undefined ? null
    : state === null ? t.nav.projectNoRepo
    : changes ? t.nav.projectChanges.replace('{n}', String(changes))
    : t.nav.projectClean
  return (
    <Link to={`/project/${project.id}`} aria-current={on ? 'page' : undefined}
      className={panelRow(on)}>
      {/* Faint while the state is read, grey outside a Git repository */}
      <span aria-hidden title={status ?? undefined}
        className={cn('mx-1 size-2.5 shrink-0 rounded-full', state === undefined ? 'bg-line' : state === null ? 'bg-fg-disabled' : changes ? 'bg-warning' : 'bg-success')} />
      <span className="flex-1 truncate">{project.name}</span>
      {changes > 0 && <span aria-hidden title={status ?? undefined} className="font-mono text-xs text-fg-muted">{changes}</span>}
      {status && <span className="sr-only">, {status}</span>}
    </Link>
  )
}

/** A labelled list of projects in the panel (the recent ones, under Home) */
export function ProjectList({ label, projects }: { label: string; projects: Project[] }) {
  const states = useRepoStates(projects)
  if (!projects.length) return null
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-8 items-center px-3 pb-1"><PanelLabel>{label}</PanelLabel></div>
      {projects.map(p => <ProjectLink key={p.id} project={p} state={states[p.id]} />)}
    </div>
  )
}
