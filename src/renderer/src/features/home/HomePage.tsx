import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUp, Box, Check, GitBranch, GripVertical, History, Info, LayoutDashboard, Layers, Maximize2, Minimize2, Plus, Radio, RefreshCw, RotateCcw, Server, TerminalSquare, X } from 'lucide-react'
import type { DockerOverview, GitRepoDetails, HomeWidget, ListeningPort, Project, SSHConnection, WidgetId } from '@shared/types'
import { DEFAULT_WIDGETS, WIDGET_IDS, masonryPlaces, type MasonryPlace } from '@shared/lib/homeWidgets'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useActivity, useToast, type ActivityEntry } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { devPorts } from '@renderer/lib/ports'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Card from '@renderer/components/ui/Card'
import { Page } from '@renderer/components/ui/Page'
import { useProjects } from '@renderer/features/projects/hooks/useProjects'
import { useHistory, useWatch } from '@renderer/hooks/useWatch'
import { patchSettings, useSettings, useSshConnections } from '@renderer/hooks/useLiveData'
import { TimeChart } from '@renderer/components/charts/TimeChart'
import { formatRelative } from '@renderer/lib/format'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import { Dot, Gauge, Pill, ROW, SmallButton, Tile, TileActions, TileLink, TileLoading, plural } from './parts'
import { CommitsWidget } from './commitsWidget'
import { BackupsWidget, HealthWidget, N8nWidget, ServicesWidget, VpnWidget } from './vpsWidgets'
import NeedsSetup from '@renderer/components/NeedsSetup'
import Mascot from '@renderer/features/assistant/Mascot'
import StatusDot, { type DotState } from '@renderer/components/ui/StatusDot'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'

// ─── Docker ───────────────────────────────────────────────────────────────────

/** First published host port of a container ("0.0.0.0:5173->5173/tcp" → 5173) */
const hostPort = (ports: string) => ports.match(/:(\d+)->/)?.[1] ?? null

function DockerTile({ docker, reload, i }: { docker: DockerOverview | null; reload: () => void; i: number }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { show } = useToast()
  const [busy, setBusy] = useState(false)
  // The project to show: one that runs, else the first one found
  const project = useMemo(() => {
    const list = [...(docker?.compose ?? [])].sort((a, b) => b.running - a.running)
    return list[0] ?? null
  }, [docker])

  const services = useMemo(() => {
    if (!docker || !project) return []
    return docker.containers
      .filter(c => c.composeProject === project.name)
      .map(c => ({
        name: c.name.replace(new RegExp(`^${project.name}[-_]`), '').replace(/[-_]\d+$/, ''),
        port: hostPort(c.ports),
        live: c.state === 'running'
      }))
  }, [docker, project])

  const act = async (action: 'up' | 'stop') => {
    if (!project) return
    setBusy(true)
    try {
      const r = await window.devforge.docker.compose(project, action)
      show({ tone: r.ok ? 'success' : 'error', title: `${project.name} · ${action === 'stop' ? t.home.stop : t.home.start}`, description: r.ok ? undefined : r.output.slice(-400) })
    } finally { setBusy(false); reload() }
  }

  if (!docker) return <Tile i={i} icon={Box} title="Docker"><TileLoading /></Tile>
  if (!docker.available || !project) {
    return <Tile i={i} icon={Box} title="Docker"><p className="text-sm text-fg-muted">{docker.available ? t.home.dockerNone : t.home.dockerOff}</p></Tile>
  }

  const running = project.running > 0
  return (
    <Tile i={i} icon={Box} title="Docker" sub={t.home.composeOf.replace('{name}', project.name)}
      aside={<Pill tone={running ? 'success' : 'muted'}>{t.home.composeOnline.replace('{r}', String(project.running)).replace('{t}', String(project.total))}</Pill>}>
      <ul className="flex flex-col text-base">
        {services.map((s, n) => (
          <li key={s.name} className={ROW}>
            <Dot live={s.live} delay={n * 0.4} />
            <span className="flex-1 truncate text-fg">{s.name}</span>
            {s.port && <span className="font-mono text-xs text-fg-muted">:{s.port}</span>}
          </li>
        ))}
      </ul>
      <TileActions>
        <SmallButton onClick={() => navigate('/docker')}>{t.home.logs}</SmallButton>
        {running
          ? <SmallButton danger disabled={busy} onClick={() => act('stop')}>{t.home.stop}</SmallButton>
          : <SmallButton disabled={busy} onClick={() => act('up')}>{t.home.start}</SmallButton>}
      </TileActions>
    </Tile>
  )
}

// ─── VPS ──────────────────────────────────────────────────────────────────────

function VpsTile({ conn, onState, i }: { conn: SSHConnection | null | undefined; onState: (s: 'ok' | 'disk' | 'down') => void; i: number }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  // Read from the background watch: no SSH session from this page
  const { statuses, config, saveConfig } = useWatch()
  const watched = !!conn && !!config?.watched.includes(conn.id)
  const status = conn ? statuses.find(s => s.connectionId === conn.id) : undefined
  const history = useHistory(watched && conn ? `vps:${conn.id}` : null, 24, 30)
  const diskAlert = config?.diskAlert ?? 85

  useEffect(() => {
    if (status?.state === 'down') onState('down')
    else if (status?.state === 'ok') onState((status.disk ?? 0) >= diskAlert ? 'disk' : 'ok')
  }, [status, diskAlert, onState])

  if (conn === undefined || !config) return <Tile i={i} icon={Server} title="VPS"><TileLoading /></Tile>
  if (conn === null) {
    return (
      <Tile i={i} icon={Server} title="VPS">
        <NeedsSetup service="server" compact />
      </Tile>
    )
  }
  if (!watched) {
    return (
      <Tile i={i} icon={Server} title={conn.name} aside={<Pill tone="muted">{t.watch.off}</Pill>}>
        <TileActions><SmallButton onClick={() => saveConfig({ watched: [...config.watched, conn.id] })}>{t.watch.enableWatch}</SmallButton></TileActions>
      </Tile>
    )
  }

  const state = status?.state === 'ok' ? t.home.sshConnected : status?.state === 'down' ? t.home.sshOffline : t.home.sshConnecting
  return (
    <Tile i={i} icon={Server} title={conn.name}
      aside={<Pill tone={status?.state === 'ok' ? 'success' : status?.state === 'down' ? 'danger' : 'muted'}>{state}</Pill>}>
      {status?.state === 'down' ? (
        <p className="text-sm text-danger">{status.error}</p>
      ) : status?.state !== 'ok' ? <TileLoading /> : (
        <>
          <Gauge i={0} label="CPU" pct={status.cpu ?? 0} />
          <Gauge i={1} label={t.home.memory} pct={status.memory ?? 0} />
          <Gauge i={2} label={t.home.disk} pct={status.disk ?? 0} />
          {history && history.points.length > 1 && (
            <TimeChart points={history.points} field={0} max={100} label={`CPU · ${t.watch.last24h.toLowerCase()}`} format={v => `${Math.round(v)} %`} height={40} />
          )}
          {(status.disk ?? 0) >= diskAlert && <p className="text-sm text-warning">{t.home.diskFull}</p>}
        </>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">{status?.at ? t.watch.lastSample.replace('{when}', formatRelative(new Date(status.at).toISOString(), lang)) : ''}</span>
        <TileLink onClick={() => navigate(`/vps/${conn.id}`)}>{t.home.dashboard} <ArrowRight size={14} aria-hidden /></TileLink>
      </div>
    </Tile>
  )
}

// ─── Git ──────────────────────────────────────────────────────────────────────

function GitTile({ repos, onFetchAll, fetching, i }: { repos: { project: Project; details: GitRepoDetails }[] | null; onFetchAll: () => void; fetching: boolean; i: number }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  // Repositories needing attention first: to push, then changed
  const shown = (repos ?? [])
    .slice()
    .sort((a, b) => (b.details.ahead - a.details.ahead) || (b.details.changes - a.details.changes))
    .slice(0, 4)

  return (
    <Tile i={i} icon={GitBranch} title="Git"
      aside={<TileLink disabled={fetching || !repos?.length} onClick={onFetchAll}>
        <RefreshCw size={14} aria-hidden className={cn(fetching && 'animate-spin')} /> {t.home.fetchAll}
      </TileLink>}>
      {!repos ? <TileLoading /> : shown.length === 0 ? <p className="text-sm text-fg-muted">{t.home.noRepos}</p> : (
        <ul className="flex flex-col text-base">
          {shown.map(({ project, details }) => (
            <li key={project.id} className="border-b border-line-subtle last:border-b-0">
              <button type="button" onClick={() => navigate('/git')} className="group -mx-2.5 flex min-h-12 w-[calc(100%+1.25rem)] min-w-0 items-center gap-3 rounded-md px-2.5 text-left transition-colors hover:bg-elevated">
                <span title={project.name} className="flex-1 truncate text-fg">{project.name}</span>
                <span className="font-mono text-xs text-fg-muted">{details.branch}</span>
                {details.ahead > 0 ? <Pill tone="accent">{t.home.ahead.replace('{n}', String(details.ahead))}</Pill>
                  : details.changes > 0 ? <Pill tone="warning">{t.home.changed.replace('{n}', String(details.changes)).replace('{s}', details.changes > 1 ? 's' : '')}</Pill>
                  : <Pill tone="success">{t.home.upToDate}</Pill>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  )
}

// ─── Ports ────────────────────────────────────────────────────────────────────

function PortsTile({ ports, i }: { ports: ListeningPort[] | null; i: number }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Tile i={i} icon={Radio} title={t.home.portsTitle} aside={<TileLink onClick={() => navigate('/ports')}>{t.nav.ports} <ArrowRight size={14} aria-hidden /></TileLink>}>
      {!ports ? <TileLoading /> : ports.length === 0 ? <p className="text-sm text-fg-muted">{t.home.portsNone}</p> : (
        <ul className="flex flex-wrap gap-2">
          {ports.slice(0, 12).map(p => (
            <li key={p.port} className="inline-flex h-8 items-center rounded-full border border-line bg-canvas px-3.5 font-mono text-xs text-fg-secondary">
              {p.port} · {p.processName.replace(/\.exe$/i, '')}
            </li>
          ))}
        </ul>
      )}
    </Tile>
  )
}

// ─── Activity ─────────────────────────────────────────────────────────────────

// ─── Active project ───────────────────────────────────────────────────────────

/** The project Forgy and the widget work on, with a quick way to change it */
function ActiveProjectCard({ projects, repos }: { projects: Project[]; repos: { project: Project; details: GitRepoDetails }[] | null }) {
  const { t } = useI18n()
  const h = t.hub
  const navigate = useNavigate()
  const { active, setActive } = useActiveProject()
  const details = active ? repos?.find(r => r.project.id === active.id)?.details : undefined

  const picker = (
    <label className="flex items-center">
      <span className="sr-only">{h.choose}</span>
      <select value={active?.id ?? ''} onChange={e => setActive(e.target.value || null)}
        className="h-7.5 max-w-[200px] rounded-md border border-line bg-surface px-2.5 text-sm text-fg-secondary outline-none focus-visible:border-accent">
        <option value="">{h.choose}</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  )

  return (
    <Card className="df-rise flex h-full flex-wrap items-center gap-5 rounded-card border-accent/25 p-5.5" style={{ '--i': 1 } as CSSProperties}>
      {active ? (
        <>
          <ProjectIcon framework={active.framework} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold tracking-[.04em] text-fg-muted uppercase">{h.activeTitle}</div>
            <button onClick={() => navigate(`/project/${active.id}`)} className="block max-w-full truncate text-left font-display text-lg font-bold tracking-[-.01em] text-fg hover:text-accent">{active.name}</button>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-fg-muted">
              {details?.branch && <span>{details.branch}</span>}
              {!!details?.changes && <span className="text-warning">{h.gitChanges.replace('{n}', String(details.changes))}</span>}
              {!!details?.ahead && <span className="text-accent">{h.gitAhead.replace('{n}', String(details.ahead))}</span>}
            </div>
          </div>
          {picker}
          <Button variant="secondary" onClick={() => navigate(`/project/${active.id}`)}>{h.openHub}</Button>
        </>
      ) : (
        <>
          <p className="min-w-0 flex-1 text-sm text-fg-secondary">{h.activeNone}</p>
          {picker}
        </>
      )}
    </Card>
  )
}

/** The icon of an activity line, by its tone */
const ACTIVITY_TONE: Record<ActivityEntry['tone'], { Icon: typeof Check; box: string }> = {
  success: { Icon: Check, box: 'bg-success-soft text-success' },
  error: { Icon: X, box: 'bg-danger-soft text-danger' },
  info: { Icon: Info, box: 'bg-elevated text-fg-secondary' }
}

function ActivityTile({ i }: { i: number }) {
  const { t, lang } = useI18n()
  const activity = useActivity()
  return (
    <Tile i={i} icon={History} title={t.home.activity}>
      {activity.length === 0 ? <p className="text-sm text-fg-muted">{t.home.noActivity}</p> : (
        <ol className="flex flex-col gap-3.5">
          {activity.slice(0, 5).map(a => {
            const tone = ACTIVITY_TONE[a.tone]
            return (
              <li key={a.at} className="flex min-w-0 items-start gap-3.5">
                <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone.box)}><tone.Icon size={13} /></span>
                <p className="min-w-0 flex-1 text-sm text-fg-muted">
                  <span className={cn('block truncate text-base font-semibold', a.tone === 'error' ? 'text-danger' : 'text-fg')}>{a.title}</span>
                  <span className="sr-only">, </span>
                  {new Date(a.at).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </li>
            )
          })}
        </ol>
      )}
    </Tile>
  )
}

// ─── State under the greeting ─────────────────────────────────────────────────

type ChipTone = 'success' | 'warning' | 'accent' | 'danger' | 'muted'
const CHIP_STATE: Record<Exclude<ChipTone, 'accent'>, DotState> = { success: 'on', warning: 'warn', danger: 'error', muted: 'off' }

/** One fact of the moment: a dot of its colour (or an icon), then the words */
function Chip({ tone, icon, children }: { tone: ChipTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-fg-secondary">
      {icon ?? (tone === 'accent'
        ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent" />
        : <StatusDot state={CHIP_STATE[tone]} live={tone === 'success'} />)}
      {children}
    </li>
  )
}

// ─── Pick up again ────────────────────────────────────────────────────────────

/** The three projects opened last, each a click away */
function ResumeCard({ projects, repos }: { projects: Project[]; repos: { project: Project; details: GitRepoDetails }[] | null }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const when = (p: Project) => p.lastOpenedAt ?? p.createdAt
  const recent = projects.slice().sort((a, b) => when(b).localeCompare(when(a))).slice(0, 3)
  return (
    <Card className="df-rise flex h-full flex-col gap-4 rounded-card p-5.5" style={{ '--i': 1 } as CSSProperties}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold tracking-[-.01em] text-fg">{t.home.resume}</h2>
        <TileLink onClick={() => navigate('/projects')}>{t.home.allProjects} <ArrowRight size={14} aria-hidden /></TileLink>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
        {recent.map((p, k) => {
          const d = repos?.find(r => r.project.id === p.id)?.details
          return (
            <article key={p.id} className="flex min-w-0 flex-col justify-between gap-3.5 rounded-xl border border-line-subtle bg-canvas p-4.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <ProjectIcon framework={p.framework} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-fg" title={p.name}>{p.name}</h3>
                  <p className="truncate font-mono text-2xs text-fg-muted" title={p.path}>{p.path}</p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                {d?.isRepo && (d.changes > 0
                  ? <Pill tone="warning">{t.home.changed.replace('{n}', String(d.changes)).replace('{s}', d.changes > 1 ? 's' : '')}</Pill>
                  : d.ahead > 0 ? <Pill tone="accent">{t.home.ahead.replace('{n}', String(d.ahead))}</Pill>
                  : <Pill tone="success">{t.home.upToDate}</Pill>)}
                <span className="truncate text-xs text-fg-muted">{formatRelative(when(p), lang)}</span>
              </div>
              <Button size="sm" variant={k === 0 ? 'primary' : 'secondary'} aria-label={t.home.openNamed.replace('{name}', p.name)}
                onClick={() => navigate(`/project/${p.id}`)}>
                {t.home.openProject}
              </Button>
            </article>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Forgy ────────────────────────────────────────────────────────────────────

/** Forgy at hand: a question typed here, or one of three asked about the active project */
function ForgyCard({ project }: { project: Project | null }) {
  const { t } = useI18n()
  const { ask, mood } = useAssistant()
  const [question, setQuestion] = useState('')
  const send = () => {
    const q = question.trim()
    if (!q) return
    ask(q)
    setQuestion('')
  }
  const suggestions = project ? [
    { label: t.home.suggestCommit, q: t.home.askCommit },
    { label: t.home.suggestReview, q: t.home.askReview },
    { label: t.home.suggestExplain, q: t.home.askExplain }
  ] : []
  return (
    <Card className="df-rise flex h-full flex-col gap-4 rounded-card border-forgy/40 p-5.5" style={{ '--i': 2 } as CSSProperties}>
      <div className="flex items-center gap-3">
        <Mascot mood={mood} size={40} followCursor={false} />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-[-.01em] text-fg">{t.assistant.mascotName}</h2>
          <p className="text-sm text-fg-muted">{t.assistant.moods[mood]} · {t.home.forgyReads}</p>
        </div>
      </div>
      <form onSubmit={e => { e.preventDefault(); send() }}
        className="flex items-center gap-2 rounded-control border border-line bg-canvas py-1.5 pr-1.5 pl-3.5 focus-within:border-accent">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.home.askForgy}</span>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder={t.home.askForgyPlaceholder}
            className="h-8 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-muted" />
        </label>
        <IconButton type="submit" size="sm" title={t.home.askSend} disabled={!question.trim()}
          className="bg-forgy text-forgy-fg hover:bg-forgy/90 hover:text-forgy-fg disabled:bg-active disabled:text-fg-muted">
          <ArrowUp size={14} />
        </IconButton>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button key={s.label} type="button" onClick={() => ask(s.q.replace('{project}', project!.name))}
              className="h-9 rounded-full border border-line bg-surface px-3.5 text-sm text-fg-secondary transition-colors hover:border-forgy/50 hover:text-fg">
              {s.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Onboarding (no projects) ─────────────────────────────────────────────────

function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Card className="df-rise flex flex-col items-center gap-5 px-8 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent"><Layers size={32} /></div>
      <div>
        <h3 className="font-display text-lg font-bold text-fg">{t.home.noProjects}</h3>
        <p className="mt-1 text-fg-secondary">{t.home.noRecentHint}</p>
      </div>
      <Button size="lg" onClick={() => navigate('/new-project')}>{t.home.createFirst}</Button>
    </Card>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

const move = (list: HomeWidget[], from: number, to: number): HomeWidget[] => {
  if (to < 0 || to >= list.length || from === to) return list
  const next = [...list]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

/** A widget; while customizing: drag it (or Alt + ↑ ↓ on its handle), widen it, remove it */
function WidgetFrame({ widget, index, count, editing, dragging, place, onHeight, children, onDragStart, onDragEnd, onDrop, onMove, onResize, onRemove }: {
  widget: HomeWidget; index: number; count: number; editing: boolean; dragging: boolean; children: ReactNode
  /** Its spot in the masonry; none on a narrow window (one column) */
  place: MasonryPlace | null
  onHeight: (height: number) => void
  onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; onMove: (to: number) => void; onResize: () => void; onRemove: () => void
}) {
  const { t } = useI18n()
  const w = t.home.widgets
  const name = w.names[widget.id]
  // Its own height, for the masonry: cards change size as their data arrives
  const box = useRef<HTMLDivElement>(null)
  const report = useRef(onHeight)
  report.current = onHeight
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => report.current(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const onKey = (e: ReactKeyboardEvent) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    const to = index + (e.key === 'ArrowUp' ? -1 : 1)
    if (to < 0 || to >= count) return
    onMove(to)
    // Focus follows the moved widget
    requestAnimationFrame(() => document.querySelectorAll<HTMLElement>('[data-widget-grip]')[to]?.focus())
  }
  return (
    <div ref={box} data-widget={widget.id}
      style={place ? { gridColumn: place.column === 'both' ? '1 / -1' : place.column, gridRow: `${place.row} / span ${place.span}` } : undefined}
      className={cn('relative min-w-0 self-start', editing && 'rounded-[16px] outline-2 outline-offset-2 outline-line outline-dashed', dragging && 'opacity-40')}
      draggable={editing} onDragStart={e => { onDragStart(); e.dataTransfer.effectAllowed = 'move' }} onDragEnd={onDragEnd}
      onDragOver={e => { if (editing) e.preventDefault() }} onDrop={e => { e.preventDefault(); onDrop() }}>
      <div className={cn(editing && 'pointer-events-none select-none')} aria-hidden={editing || undefined}>{children}</div>
      {editing && (
        <div className="absolute -top-4 right-4 z-10 flex items-center gap-0.5 rounded-lg border border-line bg-elevated p-0.5 shadow-pop">
          <button type="button" data-widget-grip title={w.move} aria-label={`${name} — ${w.move}`} onKeyDown={onKey}
            className="flex size-7 cursor-grab items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"><GripVertical size={14} /></button>
          <button type="button" onClick={onResize} title={widget.size === 'full' ? w.narrow : w.widen} aria-label={`${name} — ${widget.size === 'full' ? w.narrow : w.widen}`}
            className="hidden size-7 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg md:flex">{widget.size === 'full' ? <Minimize2 size={13} /> : <Maximize2 size={13} />}</button>
          <button type="button" onClick={onRemove} title={w.remove.replace('{name}', name)} aria-label={w.remove.replace('{name}', name)}
            className="flex size-7 items-center justify-center rounded-md text-fg-muted hover:bg-danger-soft hover:text-danger"><X size={14} /></button>
        </div>
      )}
    </div>
  )
}

/** While customizing: add a widget, back to the defaults, done */
function WidgetBar({ widgets, onAdd, onReset, onDone }: { widgets: HomeWidget[]; onAdd: (id: WidgetId) => void; onReset: () => void; onDone: () => void }) {
  const { t } = useI18n()
  const w = t.home.widgets
  const missing = WIDGET_IDS.filter(id => !widgets.some(x => x.id === id))
  return (
    <Card className="df-rise flex flex-wrap items-center gap-3 rounded-card border-accent/30 p-3.5">
      <p className="min-w-[220px] flex-1 text-base text-fg-secondary">{w.hint}</p>
      <label className="flex items-center">
        <span className="sr-only">{w.add}</span>
        <select value="" disabled={!missing.length} onChange={e => { if (e.target.value) onAdd(e.target.value as WidgetId) }}
          className="h-9 rounded-control border border-line bg-surface px-3 text-sm text-fg outline-none focus-visible:border-accent disabled:opacity-50">
          <option value="">{missing.length ? `+ ${w.add}` : w.allShown}</option>
          {missing.map(id => <option key={id} value={id}>{w.names[id]}</option>)}
        </select>
      </label>
      <Button variant="ghost" onClick={onReset}><RotateCcw size={14} /> {w.reset}</Button>
      <Button onClick={onDone}><Check size={14} /> {w.done}</Button>
    </Card>
  )
}

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
  const conn: SSHConnection | null | undefined = servers.data ? servers.data[0] ?? null : servers.error ? null : undefined
  const [repos, setRepos] = useState<{ project: Project; details: GitRepoDetails }[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [vps, setVps] = useState<'ok' | 'disk' | 'down' | null>(null)
  // The widgets chosen, from the shared settings (the defaults if they cannot be read)
  const { data: settings, error: settingsError } = useSettings()
  const widgets: HomeWidget[] | null = settings ? settings.homeWidgets ?? DEFAULT_WIDGETS : settingsError ? DEFAULT_WIDGETS : null
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
    window.devforge.docker.overview().then(setDocker).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    window.devforge.getUserName().then(n => { if (alive) setName(n) }).catch(() => {})
    window.devforge.getListeningPorts().then(p => { if (alive) setPorts(devPorts(p)) }).catch(() => { if (alive) setPorts([]) })
    loadDocker()
    return () => { alive = false }
  }, [loadDocker])

  // Git details of every project (cached a few seconds by the main process)
  const loadRepos = useCallback(async (fresh = false) => {
    const list = await Promise.all(projects.map(async project => {
      try { return { project, details: await window.devforge.git.details(project.path, fresh) } } catch { return null }
    }))
    setRepos(list.filter((r): r is { project: Project; details: GitRepoDetails } => !!r && r.details.isRepo))
  }, [projects])
  useEffect(() => { if (loaded) loadRepos() }, [loaded, loadRepos])

  const fetchAll = async () => {
    setFetching(true)
    try { await Promise.all((repos ?? []).filter(r => r.details.hasUpstream).map(r => window.devforge.git.fetch(r.project.path).catch(() => null))) } finally {
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
    ...(docker ? [running
      ? { tone: 'success' as const, text: plural(running, t.home.chipContainersOne, t.home.chipContainersMany) }
      : { tone: 'muted' as const, text: `${t.home.nothingRuns[0].toUpperCase()}${t.home.nothingRuns.slice(1)}` }] : []),
    ...(changedRepos ? [{ tone: 'warning' as const, text: plural(changedRepos, t.home.chipChangedOne, t.home.chipChangedMany) }] : []),
    ...(toPush ? [{ tone: 'accent' as const, icon: <ArrowUp size={13} aria-hidden className="text-accent" />, text: plural(toPush, t.home.pushOne, t.home.pushMany) }] : []),
    ...(vps === 'ok' ? [{ tone: 'success' as const, icon: <Server size={13} aria-hidden className="text-fg-secondary" />, text: t.home.chipVpsOk.replace('{name}', vpsName) }]
      : vps === 'disk' ? [{ tone: 'warning' as const, text: t.home.chipVpsDisk.replace('{name}', vpsName) }]
      : vps === 'down' ? [{ tone: 'danger' as const, text: t.home.chipVpsDown.replace('{name}', vpsName) }] : [])
  ]
  const greeting = now.getHours() >= 18 ? t.home.greetingEvening : t.home.greetingMorning

  // The shown widgets' spots (the active project has none without projects, unless customizing)
  const visible = (widgets ?? []).filter(w => editing || w.id !== 'active-project' || (loaded && projects.length > 0))
  const placed = masonryPlaces(visible.map(w => w.size), visible.map(w => heights[w.id]), editing ? 40 : 16)
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
              {chips.map(c => <Chip key={c.text} tone={c.tone} icon={c.icon}>{c.text}</Chip>)}
            </ul>
          ) : <p className="mt-1 text-base text-fg-secondary">{t.home.subtitle}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {!editing && <Button variant="ghost" onClick={() => setEditing(true)}><LayoutDashboard size={15} /> {t.home.widgets.customize}</Button>}
          <Button variant="secondary" onClick={() => projects[0] && window.devforge.openTerminal(projects[0].path)} disabled={!projects.length}>
            <TerminalSquare size={15} /> {t.home.openTerminal}
          </Button>
          <Button onClick={() => navigate('/new-project')}><Plus size={15} /> {t.home.newProject}</Button>
        </div>
      </header>

      {loaded && projects.length === 0 && <Onboarding />}

      {loaded && projects.length > 0 && !editing && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="min-w-0 md:col-span-2"><ResumeCard projects={projects} repos={repos} /></div>
          <ForgyCard project={active} />
        </div>
      )}

      {editing && widgets && (
        <WidgetBar widgets={widgets} onAdd={id => saveWidgets([...widgets, { id, size: id === 'activity' || id === 'active-project' ? 'full' : 'half' }])}
          onReset={() => saveWidgets(DEFAULT_WIDGETS.map(w => ({ ...w })))} onDone={() => setEditing(false)} />
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
            <WidgetFrame key={w.id} widget={w} index={i} count={widgets!.length} editing={editing} dragging={dragged === i}
              place={wide ? places[w.id] ?? null : null} onHeight={h => setHeight(w.id, h)}
              onDragStart={() => setDragged(i)} onDragEnd={() => setDragged(null)}
              onDrop={() => { if (dragged !== null) saveWidgets(move(widgets!, dragged, i)); setDragged(null) }}
              onMove={to => saveWidgets(move(widgets!, i, to))}
              onResize={() => saveWidgets(widgets!.map(x => (x.id === w.id ? { ...x, size: x.size === 'full' ? 'half' : 'full' } : x)))}
              onRemove={() => saveWidgets(widgets!.filter(x => x.id !== w.id))}>
              {content[w.id] ?? <Tile i={i} title={t.home.widgets.names[w.id]}><p className="text-sm text-fg-muted">{t.home.noProjects}</p></Tile>}
            </WidgetFrame>
          )
        })}
      </div>
    </Page>
  )
}
