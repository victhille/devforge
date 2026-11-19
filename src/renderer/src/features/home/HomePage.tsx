import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp, LayoutDashboard, Plus, Server, TerminalSquare } from 'lucide-react'
import type { DockerOverview, GitRepoDetails, HomeWidget, ListeningPort, Project, SSHConnection, WidgetId } from '@shared/types'
import { DEFAULT_WIDGETS, masonryPlaces, type MasonryPlace } from '@shared/lib/homeWidgets'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { devPorts } from '@renderer/lib/ports'
import Button from '@renderer/components/ui/Button'
import { Page } from '@renderer/components/ui/Page'
import { useProjects } from '@renderer/features/projects/hooks/useProjects'
import { patchSettings, useSettings, useSshConnections } from '@renderer/hooks/useLiveData'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import { Tile, plural } from './parts'
import { CommitsWidget } from './commitsWidget'
import { BackupsWidget, HealthWidget, N8nWidget, ServicesWidget, VpnWidget } from './vpsWidgets'
import { DockerTile, VpsTile, GitTile, PortsTile, ActiveProjectCard, ActivityTile } from './tiles'
import { ChipTone, Chip, ResumeCard, ForgyCard, Onboarding } from './cards'
import { move, WidgetFrame, WidgetBar } from './widgetFrame'

// ─── Layout ───────────────────────────────────────────────────────────────────
// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { projects, loaded } = useProjects()
  const { active } = useActiveProject()
  const [name, setName] = useState('')
  const [docker, setDocker] = useState<DockerOverview | null>(null)
  const [ports, setPorts] = useState<ListeningPort[] | null>(null)
  // The first server (undefined while the list is read, null without one)
  const servers = useSshConnections()
  const conn: SSHConnection | null | undefined = servers.data ? (servers.data[0] ?? null) : servers.error ? null : undefined
  const [repos, setRepos] = useState<{ project: Project; details: GitRepoDetails }[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [vps, setVps] = useState<'ok' | 'disk' | 'down' | null>(null)
  // The widgets chosen, from the shared settings (the defaults if they cannot be read)
  const { data: settings, error: settingsError } = useSettings()
  const widgets: HomeWidget[] | null = settings ? (settings.homeWidgets ?? DEFAULT_WIDGETS) : settingsError ? DEFAULT_WIDGETS : null
  const [editing, setEditing] = useState(false)
  const [dragged, setDragged] = useState<number | null>(null)
  // Masonry from md up (two columns), the cards' measured heights
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [heights, setHeights] = useState<Record<string, number>>({})
  const setHeight = useCallback((id: string, h: number) => setHeights(m => (m[id] === h ? m : { ...m, [id]: h })), [])

  const saveWidgets = useCallback((next: HomeWidget[]) => {
    patchSettings({ homeWidgets: next })
    window.devforge.setHomeWidgets(next).catch(() => {})
  }, [])

  const loadDocker = useCallback(() => {
    window.devforge.docker
      .overview()
      .then(setDocker)
      .catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    window.devforge
      .getUserName()
      .then(n => {
        if (alive) setName(n)
      })
      .catch(() => {})
    window.devforge
      .getListeningPorts()
      .then(p => {
        if (alive) setPorts(devPorts(p))
      })
      .catch(() => {
        if (alive) setPorts([])
      })
    loadDocker()
    return () => {
      alive = false
    }
  }, [loadDocker])

  // Git details of every project (cached a few seconds by the main process)
  const loadRepos = useCallback(
    async (fresh = false) => {
      const list = await Promise.all(
        projects.map(async project => {
          try {
            return { project, details: await window.devforge.git.details(project.path, fresh) }
          } catch {
            return null
          }
        })
      )
      setRepos(list.filter((r): r is { project: Project; details: GitRepoDetails } => !!r && r.details.isRepo))
    },
    [projects]
  )
  useEffect(() => {
    if (loaded) loadRepos()
  }, [loaded, loadRepos])

  const fetchAll = async () => {
    setFetching(true)
    try {
      await Promise.all((repos ?? []).filter(r => r.details.hasUpstream).map(r => window.devforge.git.fetch(r.project.path).catch(() => null)))
    } finally {
      setFetching(false)
      loadRepos(true)
    }
  }

  const now = new Date()
  const running = docker?.containers.filter(c => c.state === 'running').length ?? 0
  const toPush = repos?.filter(r => r.details.ahead > 0).length ?? 0
  const changedRepos = repos?.filter(r => r.details.changes > 0).length ?? 0
  const vpsName = conn?.name || t.home.vpsFallback
  // The facts of the moment, as chips (only what is known)
  const chips: { tone: ChipTone; icon?: ReactNode; text: string }[] = [
    ...(docker
      ? [
          running
            ? { tone: 'success' as const, text: plural(running, t.home.chipContainersOne, t.home.chipContainersMany) }
            : { tone: 'muted' as const, text: `${t.home.nothingRuns[0].toUpperCase()}${t.home.nothingRuns.slice(1)}` }
        ]
      : []),
    ...(changedRepos ? [{ tone: 'warning' as const, text: plural(changedRepos, t.home.chipChangedOne, t.home.chipChangedMany) }] : []),
    ...(toPush
      ? [{ tone: 'accent' as const, icon: <ArrowUp size={13} aria-hidden className="text-accent" />, text: plural(toPush, t.home.pushOne, t.home.pushMany) }]
      : []),
    ...(vps === 'ok'
      ? [{ tone: 'success' as const, icon: <Server size={13} aria-hidden className="text-fg-secondary" />, text: t.home.chipVpsOk.replace('{name}', vpsName) }]
      : vps === 'disk'
        ? [{ tone: 'warning' as const, text: t.home.chipVpsDisk.replace('{name}', vpsName) }]
        : vps === 'down'
          ? [{ tone: 'danger' as const, text: t.home.chipVpsDown.replace('{name}', vpsName) }]
          : [])
  ]
  const greeting = now.getHours() >= 18 ? t.home.greetingEvening : t.home.greetingMorning

  // The shown widgets' spots (the active project has none without projects, unless customizing)
  const visible = (widgets ?? []).filter(w => editing || w.id !== 'active-project' || (loaded && projects.length > 0))
  const placed = masonryPlaces(
    visible.map(w => w.size),
    visible.map(w => heights[w.id]),
    editing ? 40 : 16
  )
  const places: Partial<Record<WidgetId, MasonryPlace>> = Object.fromEntries(visible.map((w, k) => [w.id, placed[k]]))

  return (
    <Page>
      <header className="df-rise flex flex-wrap items-end justify-between gap-3.5">
        <div className="min-w-0">
          <p className="text-sm text-fg-muted first-letter:uppercase">
            {now.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="mt-1 font-display text-hero font-bold tracking-[-.025em] text-fg">{name ? `${greeting} ${name}` : greeting}</h1>
          {chips.length > 0 ? (
            <ul aria-label={t.home.statusLabel} className="mt-3.5 flex flex-wrap gap-2.5">
              {chips.map(c => (
                <Chip key={c.text} tone={c.tone} icon={c.icon}>
                  {c.text}
                </Chip>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-base text-fg-secondary">{t.home.subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <Button variant="ghost" onClick={() => setEditing(true)}>
              <LayoutDashboard size={15} /> {t.home.widgets.customize}
            </Button>
          )}
          <Button variant="secondary" onClick={() => projects[0] && window.devforge.openTerminal(projects[0].path)} disabled={!projects.length}>
            <TerminalSquare size={15} /> {t.home.openTerminal}
          </Button>
          <Button onClick={() => navigate('/new-project')}>
            <Plus size={15} /> {t.home.newProject}
          </Button>
        </div>
      </header>

      {loaded && projects.length === 0 && <Onboarding />}

      {loaded && projects.length > 0 && !editing && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="min-w-0 md:col-span-2">
            <ResumeCard projects={projects} repos={repos} />
          </div>
          <ForgyCard project={active} />
        </div>
      )}

      {editing && widgets && (
        <WidgetBar
          widgets={widgets}
          onAdd={id => saveWidgets([...widgets, { id, size: id === 'activity' || id === 'active-project' ? 'full' : 'half' }])}
          onReset={() => saveWidgets(DEFAULT_WIDGETS.map(w => ({ ...w })))}
          onDone={() => setEditing(false)}
        />
      )}

      {widgets && widgets.length === 0 && !editing && <p className="text-sm text-fg-muted">{t.home.widgets.empty}</p>}

      {/* Masonry on a wide window: rows of 4 px, each card placed in the shorter column.
          More room below each card while customizing: its toolbar sits on its top edge */}
      <div className={cn('grid grid-cols-1 gap-5', wide && 'grid-cols-2 gap-y-0 [grid-auto-rows:4px]', editing && 'pt-3', editing && !wide && 'gap-y-8')}>
        {(widgets ?? []).map((w, i) => {
          const content: Record<WidgetId, ReactNode> = {
            'active-project': loaded && projects.length > 0 ? <ActiveProjectCard projects={projects} repos={repos} /> : null,
            docker: <DockerTile i={i + 2} docker={docker} reload={loadDocker} />,
            vps: <VpsTile i={i + 2} conn={conn} onState={setVps} />,
            git: <GitTile i={i + 2} repos={repos} fetching={fetching} onFetchAll={fetchAll} />,
            ports: <PortsTile i={i + 2} ports={ports} />,
            activity: <ActivityTile i={i + 2} />,
            health: <HealthWidget i={i + 2} />,
            services: <ServicesWidget i={i + 2} />,
            backups: <BackupsWidget i={i + 2} />,
            n8n: <N8nWidget i={i + 2} />,
            vpn: <VpnWidget i={i + 2} />,
            commits: <CommitsWidget i={i + 2} />
          }
          if (!content[w.id] && !editing) return null
          return (
            <WidgetFrame
              key={w.id}
              widget={w}
              index={i}
              count={widgets!.length}
              editing={editing}
              dragging={dragged === i}
              place={wide ? (places[w.id] ?? null) : null}
              onHeight={h => setHeight(w.id, h)}
              onDragStart={() => setDragged(i)}
              onDragEnd={() => setDragged(null)}
              onDrop={() => {
                if (dragged !== null) saveWidgets(move(widgets!, dragged, i))
                setDragged(null)
              }}
              onMove={to => saveWidgets(move(widgets!, i, to))}
              onResize={() => saveWidgets(widgets!.map(x => (x.id === w.id ? { ...x, size: x.size === 'full' ? 'half' : 'full' } : x)))}
              onRemove={() => saveWidgets(widgets!.filter(x => x.id !== w.id))}
            >
              {content[w.id] ?? (
                <Tile i={i} title={t.home.widgets.names[w.id]}>
                  <p className="text-sm text-fg-muted">{t.home.noProjects}</p>
                </Tile>
              )}
            </WidgetFrame>
          )
        })}
      </div>
    </Page>
  )
}
