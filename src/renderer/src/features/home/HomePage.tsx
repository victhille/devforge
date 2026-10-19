import { useCallback, useEffect, useMemo, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layers, Plus, RefreshCw, TerminalSquare } from 'lucide-react'
import type { DockerOverview, GitRepoDetails, ListeningPort, Project, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useActivity, useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { devPorts } from '@renderer/lib/ports'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Spinner from '@renderer/components/ui/Spinner'
import { Page } from '@renderer/components/ui/Page'
import { useProjects } from '@renderer/features/projects/hooks/useProjects'
import { useHistory, useWatch } from '@renderer/hooks/useWatch'
import { TimeChart } from '@renderer/components/charts/TimeChart'
import { formatRelative } from '@renderer/lib/format'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'

// ─── Building blocks ──────────────────────────────────────────────────────────

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace('{n}', String(n)))

/** A dashboard card: title row, then content; `i` staggers the entrance */
function Tile({ i, title, aside, className, children }: { i: number; title: ReactNode; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn('df-rise df-lift flex min-w-0 flex-col gap-3 rounded-[14px] p-[18px] hover:border-line', className)} style={{ '--i': i } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="truncate text-md font-semibold text-fg">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  )
}

function Pill({ tone, children }: { tone: 'success' | 'warning' | 'accent' | 'muted'; children: ReactNode }) {
  const tones = {
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    accent: 'bg-accent-soft text-accent',
    muted: 'bg-elevated text-fg-muted'
  }
  return <span className={cn('shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-medium', tones[tone])}>{children}</span>
}

function Dot({ live, delay = 0 }: { live: boolean; delay?: number }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', live ? 'df-ping bg-success' : 'bg-fg-disabled')}
      style={{ animationDelay: `${delay}s` }}
    />
  )
}

function Gauge({ label, pct, i }: { label: string; pct: number; i: number }) {
  return (
    <div className="flex flex-col gap-1.5 text-[12.5px]">
      <div className="flex justify-between">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono text-fg">{Math.round(pct)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn('df-grow h-full rounded-full', pct >= 80 ? 'bg-warning' : 'bg-accent')}
          style={{ width: `${Math.min(100, pct)}%`, animationDelay: `${i * 0.15}s` }}
        />
      </div>
    </div>
  )
}

const SmallButton = ({ danger, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) => (
  <button
    {...rest}
    className={cn(
      'h-8 rounded-lg border text-[12.5px] font-medium transition-colors disabled:opacity-50',
      danger ? 'border-danger/30 bg-danger-soft text-danger hover:bg-danger hover:text-white' : 'border-line bg-elevated text-fg hover:bg-hover',
      className
    )}
  />
)

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

  if (!docker) return <Tile i={i} title="Docker"><Spinner /></Tile>
  if (!docker.available || !project) {
    return <Tile i={i} title="Docker"><p className="text-sm text-fg-muted">{docker.available ? t.home.dockerNone : t.home.dockerOff}</p></Tile>
  }

  const running = project.running > 0
  return (
    <Tile
      i={i}
      title={`Docker · ${project.name}`}
      aside={<Pill tone={running ? 'success' : 'muted'}>{t.home.composeOnline.replace('{r}', String(project.running)).replace('{t}', String(project.total))}</Pill>}
    >
      <div className="flex flex-col gap-2 text-base">
        {services.map((s, n) => (
          <div key={s.name} className="flex items-center gap-2.5">
            <Dot live={s.live} delay={n * 0.4} />
            <span className="flex-1 truncate text-fg">{s.name}</span>
            {s.port && <span className="font-mono text-xs text-fg-muted">:{s.port}</span>}
          </div>
        ))}
      </div>
      <div className="mt-auto flex gap-2">
        <SmallButton className="flex-1" onClick={() => navigate('/docker')}>{t.home.logs}</SmallButton>
        {running
          ? <SmallButton danger className="flex-1" disabled={busy} onClick={() => act('stop')}>{t.home.stop}</SmallButton>
          : <SmallButton className="flex-1" disabled={busy} onClick={() => act('up')}>{t.home.start}</SmallButton>}
      </div>
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

  if (conn === undefined || !config) return <Tile i={i} title="VPS"><Spinner /></Tile>
  if (conn === null) {
    return (
      <Tile i={i} title="VPS">
        <p className="text-sm text-fg-muted">{t.home.noServer}</p>
        <SmallButton className="mt-auto" onClick={() => navigate('/ssh')}>{t.home.addServer}</SmallButton>
      </Tile>
    )
  }
  if (!watched) {
    return (
      <Tile i={i} title={conn.name} aside={<span className="font-mono text-xs text-fg-muted">{t.watch.off}</span>}>
        <SmallButton className="mt-auto" onClick={() => saveConfig({ watched: [...config.watched, conn.id] })}>{t.watch.enableWatch}</SmallButton>
      </Tile>
    )
  }

  const state = status?.state === 'ok' ? t.home.sshConnected : status?.state === 'down' ? t.home.sshOffline : t.home.sshConnecting
  return (
    <Tile i={i} title={conn.name} aside={<span className={cn('font-mono text-xs', status?.state === 'down' ? 'text-danger' : 'text-fg-secondary')} title={status?.at ? new Date(status.at).toLocaleTimeString() : undefined}>{state}</span>}>
      {status?.state === 'down' ? (
        <p className="text-sm text-danger">{status.error}</p>
      ) : status?.state !== 'ok' ? <Spinner /> : (
        <>
          <Gauge i={0} label="CPU" pct={status.cpu ?? 0} />
          <Gauge i={1} label={t.home.memory} pct={status.memory ?? 0} />
          <Gauge i={2} label={t.home.disk} pct={status.disk ?? 0} />
          {history && history.points.length > 1 && (
            <TimeChart points={history.points} field={0} max={100} label={`CPU · ${t.watch.last24h.toLowerCase()}`} format={v => `${Math.round(v)} %`} height={40} />
          )}
          {(status.disk ?? 0) >= diskAlert && (
            <p className="mt-auto text-xs text-fg-secondary">
              {t.home.diskFull}{' '}
              <button onClick={() => navigate(`/vps/${conn.id}`)} className="text-accent hover:underline">{t.home.openDashboard}</button>
            </p>
          )}
          {status.at && <span className="font-mono text-2xs text-fg-muted">{t.watch.lastSample.replace('{when}', formatRelative(new Date(status.at).toISOString(), lang))}</span>}
        </>
      )}
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
    <Tile i={i} title="Git">
      {!repos ? <Spinner /> : shown.length === 0 ? <p className="text-sm text-fg-muted">{t.home.noRepos}</p> : (
        <div className="flex flex-col gap-2.5 text-base">
          {shown.map(({ project, details }) => (
            <button key={project.id} onClick={() => navigate('/git')} className="flex items-center gap-2.5 text-left">
              <span className="flex-1 truncate text-fg">{project.name}</span>
              <span className="font-mono text-xs text-fg-secondary">{details.branch}</span>
              {details.ahead > 0 ? <Pill tone="accent">{t.home.ahead.replace('{n}', String(details.ahead))}</Pill>
                : details.changes > 0 ? <Pill tone="warning">{t.home.changed.replace('{n}', String(details.changes)).replace('{s}', details.changes > 1 ? 's' : '')}</Pill>
                : <Pill tone="success">{t.home.upToDate}</Pill>}
            </button>
          ))}
        </div>
      )}
      <SmallButton className="mt-auto flex items-center justify-center gap-1.5" disabled={fetching || !repos?.length} onClick={onFetchAll}>
        {fetching ? <Spinner /> : <RefreshCw size={13} />} {t.home.fetchAll}
      </SmallButton>
    </Tile>
  )
}

// ─── Ports ────────────────────────────────────────────────────────────────────

function PortsTile({ ports, i }: { ports: ListeningPort[] | null; i: number }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Tile i={i} title={t.home.portsTitle}>
      {!ports ? <Spinner /> : ports.length === 0 ? <p className="text-sm text-fg-muted">{t.home.portsNone}</p> : (
        <div className="flex flex-wrap gap-2">
          {ports.slice(0, 12).map(p => (
            <button key={p.port} onClick={() => navigate('/ports')} className="rounded-lg border border-line bg-elevated px-2.5 py-1.5 font-mono text-xs text-fg transition-colors hover:bg-hover">
              {p.port} · {p.processName.replace(/\.exe$/i, '')}
            </button>
          ))}
        </div>
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
        className="h-8 max-w-[200px] rounded-lg border border-line bg-elevated px-2.5 text-sm text-fg-secondary outline-none">
        <option value="">{h.choose}</option>
        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  )

  return (
    <Card className="df-rise flex flex-wrap items-center gap-4 rounded-[14px] border-accent/25 p-[18px]" style={{ '--i': 1 } as CSSProperties}>
      {active ? (
        <>
          <ProjectIcon framework={active.framework} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{h.activeTitle}</div>
            <button onClick={() => navigate(`/project/${active.id}`)} className="block max-w-full truncate text-left text-lg font-semibold text-fg hover:text-accent">{active.name}</button>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-fg-muted">
              {details?.branch && <span>{details.branch}</span>}
              {!!details?.changes && <span className="text-warning">{h.gitChanges.replace('{n}', String(details.changes))}</span>}
              {!!details?.ahead && <span className="text-accent">{h.gitAhead.replace('{n}', String(details.ahead))}</span>}
            </div>
          </div>
          {picker}
          <Button onClick={() => navigate(`/project/${active.id}`)}>{h.openHub}</Button>
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

function ActivityTile({ i }: { i: number }) {
  const { t } = useI18n()
  const activity = useActivity()
  return (
    <Tile i={i} title={t.home.activity} className="md:col-span-2">
      {activity.length === 0 ? <p className="text-sm text-fg-muted">{t.home.noActivity}</p> : (
        <ol className="flex flex-col gap-2.5 text-base">
          {activity.slice(0, 5).map(a => (
            <li key={a.at} className="flex items-baseline gap-3">
              <span className="w-11 shrink-0 font-mono text-xs text-fg-muted">
                {new Date(a.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className={cn('min-w-0 truncate', a.tone === 'error' ? 'text-danger' : 'text-fg')}>{a.title}</span>
            </li>
          ))}
        </ol>
      )}
    </Tile>
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
        <h3 className="text-lg font-semibold text-fg">{t.home.noProjects}</h3>
        <p className="mt-1 text-fg-secondary">{t.home.noRecentHint}</p>
      </div>
      <Button size="lg" onClick={() => navigate('/new-project')}>{t.home.createFirst}</Button>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { projects, loaded } = useProjects()
  const [name, setName] = useState('')
  const [docker, setDocker] = useState<DockerOverview | null>(null)
  const [ports, setPorts] = useState<ListeningPort[] | null>(null)
  const [conn, setConn] = useState<SSHConnection | null | undefined>(undefined)
  const [repos, setRepos] = useState<{ project: Project; details: GitRepoDetails }[] | null>(null)
  const [fetching, setFetching] = useState(false)
  const [vps, setVps] = useState<'ok' | 'disk' | 'down' | null>(null)

  const loadDocker = useCallback(() => {
    window.devforge.docker.overview().then(setDocker).catch(() => {})
  }, [])

  useEffect(() => {
    let alive = true
    window.devforge.getUserName().then(n => { if (alive) setName(n) }).catch(() => {})
    window.devforge.getListeningPorts().then(p => { if (alive) setPorts(devPorts(p)) }).catch(() => { if (alive) setPorts([]) })
    window.devforge.getSshConnections().then(list => { if (alive) setConn(list[0] ?? null) }).catch(() => { if (alive) setConn(null) })
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
  const summary = [
    running ? plural(running, t.home.servicesOne, t.home.servicesMany) : t.home.nothingRuns,
    toPush ? plural(toPush, t.home.pushOne, t.home.pushMany) : null,
    vps === 'ok' ? t.home.vpsOk : vps === 'disk' ? t.home.vpsDiskFull : vps === 'down' ? t.home.vpsDown : null
  ].filter(Boolean).join(' · ')
  const greeting = now.getHours() >= 18 ? t.home.greetingEvening : t.home.greetingMorning

  return (
    <Page className="max-w-[1180px] gap-6 px-8 pt-7">
      <header className="df-rise flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="font-mono text-xs font-medium uppercase tracking-[.04em] text-fg-muted">
            {now.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="mt-1.5 mb-1 text-[30px] leading-tight font-semibold tracking-[-.02em] text-fg">{name ? `${greeting} ${name}` : greeting}</h1>
          <p className="text-md text-fg-secondary">{docker ? `${summary[0].toUpperCase()}${summary.slice(1)}.` : t.home.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => projects[0] && window.devforge.openTerminal(projects[0].path)} disabled={!projects.length}>
            <TerminalSquare size={15} /> {t.home.openTerminal}
          </Button>
          <Button onClick={() => navigate('/new-project')}><Plus size={15} /> {t.home.newProject}</Button>
        </div>
      </header>

      {loaded && projects.length === 0 ? <Onboarding /> : <ActiveProjectCard projects={projects} repos={repos} />}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DockerTile i={2} docker={docker} reload={loadDocker} />
        <VpsTile i={3} conn={conn} onState={setVps} />
        <GitTile i={4} repos={repos} fetching={fetching} onFetchAll={fetchAll} />
        <PortsTile i={5} ports={ports} />
        <ActivityTile i={6} />
      </div>
    </Page>
  )
}
