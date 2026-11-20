import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Box, Check, GitBranch, History, Info, Radio, RefreshCw, Server, X } from 'lucide-react'
import type { DockerOverview, GitRepoDetails, ListeningPort, Project, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useActivity, useToast, type ActivityEntry } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { useHistory, useWatch } from '@renderer/hooks/useWatch'
import { TimeChart } from '@renderer/components/charts/TimeChart'
import { formatRelative } from '@renderer/lib/format'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import { Dot, Gauge, Pill, ROW, SmallButton, Tile, TileActions, TileLink, TileLoading } from './parts'
import NeedsSetup from '@renderer/components/NeedsSetup'

// ─── Docker ───────────────────────────────────────────────────────────────────

/** First published host port of a container ("0.0.0.0:5173->5173/tcp" → 5173) */
const hostPort = (ports: string) => ports.match(/:(\d+)->/)?.[1] ?? null

export function DockerTile({ docker, reload, i }: { docker: DockerOverview | null; reload: () => void; i: number }) {
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
      show({
        tone: r.ok ? 'success' : 'error',
        title: `${project.name} · ${action === 'stop' ? t.home.stop : t.home.start}`,
        description: r.ok ? undefined : r.output.slice(-400)
      })
    } finally {
      setBusy(false)
      reload()
    }
  }

  if (!docker)
    return (
      <Tile i={i} icon={Box} title="Docker">
        <TileLoading />
      </Tile>
    )
  if (!docker.available || !project) {
    return (
      <Tile i={i} icon={Box} title="Docker">
        <p className="text-sm text-fg-muted">{docker.available ? t.home.dockerNone : t.home.dockerOff}</p>
      </Tile>
    )
  }

  const running = project.running > 0
  return (
    <Tile
      i={i}
      icon={Box}
      title="Docker"
      sub={t.home.composeOf.replace('{name}', project.name)}
      aside={
        <Pill tone={running ? 'success' : 'muted'}>{t.home.composeOnline.replace('{r}', String(project.running)).replace('{t}', String(project.total))}</Pill>
      }
    >
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
        {running ? (
          <SmallButton danger disabled={busy} onClick={() => act('stop')}>
            {t.home.stop}
          </SmallButton>
        ) : (
          <SmallButton disabled={busy} onClick={() => act('up')}>
            {t.home.start}
          </SmallButton>
        )}
      </TileActions>
    </Tile>
  )
}

// ─── VPS ──────────────────────────────────────────────────────────────────────

export function VpsTile({ conn, onState, i }: { conn: SSHConnection | null | undefined; onState: (s: 'ok' | 'disk' | 'down') => void; i: number }) {
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

  if (conn === undefined || !config)
    return (
      <Tile i={i} icon={Server} title="VPS">
        <TileLoading />
      </Tile>
    )
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
        <TileActions>
          <SmallButton onClick={() => saveConfig({ watched: [...config.watched, conn.id] })}>{t.watch.enableWatch}</SmallButton>
        </TileActions>
      </Tile>
    )
  }

  const state = status?.state === 'ok' ? t.home.sshConnected : status?.state === 'down' ? t.home.sshOffline : t.home.sshConnecting
  return (
    <Tile
      i={i}
      icon={Server}
      title={conn.name}
      aside={<Pill tone={status?.state === 'ok' ? 'success' : status?.state === 'down' ? 'danger' : 'muted'}>{state}</Pill>}
    >
      {status?.state === 'down' ? (
        <p className="text-sm text-danger">{status.error}</p>
      ) : status?.state !== 'ok' ? (
        <TileLoading />
      ) : (
        <>
          <Gauge i={0} label="CPU" pct={status.cpu ?? 0} />
          <Gauge i={1} label={t.home.memory} pct={status.memory ?? 0} />
          <Gauge i={2} label={t.home.disk} pct={status.disk ?? 0} />
          {history && history.points.length > 1 && (
            <TimeChart
              points={history.points}
              field={0}
              max={100}
              label={`CPU · ${t.watch.last24h.toLowerCase()}`}
              format={v => `${Math.round(v)} %`}
              height={40}
            />
          )}
          {(status.disk ?? 0) >= diskAlert && <p className="text-sm text-warning">{t.home.diskFull}</p>}
        </>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-fg-muted">
          {status?.at ? t.watch.lastSample.replace('{when}', formatRelative(new Date(status.at).toISOString(), lang)) : ''}
        </span>
        <TileLink onClick={() => navigate(`/vps/${conn.id}`)}>
          {t.home.dashboard} <ArrowRight size={14} aria-hidden />
        </TileLink>
      </div>
    </Tile>
  )
}

// ─── Git ──────────────────────────────────────────────────────────────────────

export function GitTile({
  repos,
  onFetchAll,
  fetching,
  i
}: {
  repos: { project: Project; details: GitRepoDetails }[] | null
  onFetchAll: () => void
  fetching: boolean
  i: number
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  // Repositories needing attention first: to push, then changed
  const shown = (repos ?? [])
    .slice()
    .sort((a, b) => b.details.ahead - a.details.ahead || b.details.changes - a.details.changes)
    .slice(0, 4)

  return (
    <Tile
      i={i}
      icon={GitBranch}
      title="Git"
      aside={
        <TileLink disabled={fetching || !repos?.length} onClick={onFetchAll}>
          <RefreshCw size={14} aria-hidden className={cn(fetching && 'animate-spin')} /> {t.home.fetchAll}
        </TileLink>
      }
    >
      {!repos ? (
        <TileLoading />
      ) : shown.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.home.noRepos}</p>
      ) : (
        <ul className="flex flex-col text-base">
          {shown.map(({ project, details }) => (
            <li key={project.id} className="border-b border-line-subtle last:border-b-0">
              <button
                type="button"
                onClick={() => navigate('/git')}
                className="group -mx-2.5 flex min-h-12 w-[calc(100%+1.25rem)] min-w-0 items-center gap-3 rounded-md px-2.5 text-left transition-colors hover:bg-elevated"
              >
                <span title={project.name} className="flex-1 truncate text-fg">
                  {project.name}
                </span>
                <span className="font-mono text-xs text-fg-muted">{details.branch}</span>
                {details.ahead > 0 ? (
                  <Pill tone="accent">{t.home.ahead.replace('{n}', String(details.ahead))}</Pill>
                ) : details.changes > 0 ? (
                  <Pill tone="warning">{t.home.changed.replace('{n}', String(details.changes)).replace('{s}', details.changes > 1 ? 's' : '')}</Pill>
                ) : (
                  <Pill tone="success">{t.home.upToDate}</Pill>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  )
}

// ─── Ports ────────────────────────────────────────────────────────────────────

export function PortsTile({ ports, i }: { ports: ListeningPort[] | null; i: number }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Tile
      i={i}
      icon={Radio}
      title={t.home.portsTitle}
      aside={
        <TileLink onClick={() => navigate('/ports')}>
          {t.nav.ports} <ArrowRight size={14} aria-hidden />
        </TileLink>
      }
    >
      {!ports ? (
        <TileLoading />
      ) : ports.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.home.portsNone}</p>
      ) : (
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
export function ActiveProjectCard({ projects, repos }: { projects: Project[]; repos: { project: Project; details: GitRepoDetails }[] | null }) {
  const { t } = useI18n()
  const h = t.hub
  const navigate = useNavigate()
  const { active, setActive } = useActiveProject()
  const details = active ? repos?.find(r => r.project.id === active.id)?.details : undefined

  const picker = (
    <label className="flex items-center">
      <span className="sr-only">{h.choose}</span>
      <select
        value={active?.id ?? ''}
        onChange={e => setActive(e.target.value || null)}
        className="h-7.5 max-w-[200px] rounded-md border border-line-strong bg-surface px-2.5 text-sm text-fg-secondary outline-none focus-visible:border-accent"
      >
        <option value="">{h.choose}</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
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
            <button
              onClick={() => navigate(`/project/${active.id}`)}
              className="block max-w-full truncate text-left font-display text-lg font-bold tracking-[-.01em] text-fg hover:text-accent"
            >
              {active.name}
            </button>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-fg-muted">
              {details?.branch && <span>{details.branch}</span>}
              {!!details?.changes && <span className="text-warning">{h.gitChanges.replace('{n}', String(details.changes))}</span>}
              {!!details?.ahead && <span className="text-accent">{h.gitAhead.replace('{n}', String(details.ahead))}</span>}
            </div>
          </div>
          {picker}
          <Button variant="secondary" onClick={() => navigate(`/project/${active.id}`)}>
            {h.openHub}
          </Button>
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

export function ActivityTile({ i }: { i: number }) {
  const { t, lang } = useI18n()
  const activity = useActivity()
  return (
    <Tile i={i} icon={History} title={t.home.activity}>
      {activity.length === 0 ? (
        <p className="text-sm text-fg-muted">{t.home.noActivity}</p>
      ) : (
        <ol className="flex flex-col gap-3.5">
          {activity.slice(0, 5).map(a => {
            const tone = ACTIVITY_TONE[a.tone]
            return (
              <li key={a.at} className="flex min-w-0 items-start gap-3.5">
                <span aria-hidden className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg', tone.box)}>
                  <tone.Icon size={13} />
                </span>
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
