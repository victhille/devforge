import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Bot, Code2, Container, Database, ExternalLink, FileKey2, FolderOpen, GitBranch, Globe, Play, Rocket, ScrollText,
  Star, Terminal, Trash2, Wifi, X, XCircle, Maximize2
} from 'lucide-react'
import type { DbConnection, DefaultIDE, DockerOverview, GitRepoDetails, LinkKind, ListeningPort, LocalDomain, ProjectHub } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import { cn } from '@renderer/lib/cn'
import { formatDate, formatRelative, formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import CommitModal from '@renderer/features/git/CommitModal'
import { ComposeDetail } from '@renderer/features/docker/ComposeDetail'
import ProjectEnvEditor from '@renderer/features/envfiles/ProjectEnvEditor'
import ProjectIcon from './components/ProjectIcon'
import FileTree from './components/FileTree'
import VercelPanel from './VercelPanel'
import EnvSyncPanel from './EnvSyncPanel'
import GithubPanel from './GithubPanel'
import SymfonyPanel from './symfony/SymfonyPanel'
import NextPanel from './nextjs/NextPanel'
import LaravelPanel from './laravel/LaravelPanel'
import TerminalTabs from '@renderer/features/terminal/TerminalTabs'
import DbExplorer from '@renderer/features/database/DbExplorer'
import PackagesPanel from './PackagesPanel'
import GroupProjects from './GroupProjects'
import IdeSelect from './components/IdeSelect'
import { usePreferredIde } from '@renderer/lib/ide'

type Tab = 'overview' | 'git' | 'github' | 'symfony' | 'nextjs' | 'laravel' | 'terminal' | 'docker' | 'env' | 'packages' | 'database' | 'logs' | 'ports' | 'deploy' | 'vercel' | 'files'
const TABS: Tab[] = ['overview', 'git', 'github', 'symfony', 'nextjs', 'laravel', 'terminal', 'docker', 'env', 'packages', 'database', 'logs', 'ports', 'deploy', 'vercel', 'files']

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p

// ─── Small pieces ─────────────────────────────────────────────────────────────

function Tile({ title, icon, onSee, i, children }: { title: string; icon: ReactNode; onSee?: () => void; i: number; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <Card className="df-rise flex min-w-0 flex-col gap-3 p-[18px]" style={{ '--i': i } as CSSProperties}>
      <div className="flex items-center gap-2">
        <span className="text-fg-muted">{icon}</span>
        <h2 className="flex-1 truncate text-md font-semibold text-fg">{title}</h2>
        {onSee && <button onClick={onSee} className="text-xs font-medium text-accent hover:underline">{t.hub.see}</button>}
      </div>
      {children}
    </Card>
  )
}

function Origin({ origin }: { origin: 'auto' | 'manual' }) {
  const { t } = useI18n()
  return <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[10.5px] text-fg-muted">{origin === 'auto' ? t.hub.auto : t.hub.manual}</span>
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-fg-muted">{children}</p>

/** A linked resource row: label, origin, actions, and untie */
function LinkRow({ children, origin, onUntie, actions }: { children: ReactNode; origin: 'auto' | 'manual'; onUntie: () => void; actions?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="group flex items-center gap-3 border-t border-line-subtle px-[18px] py-3 first:border-t-0">
      <div className="min-w-0 flex-1">{children}</div>
      <Origin origin={origin} />
      {actions}
      <IconButton size="sm" title={t.hub.untie} onClick={onUntie} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"><X size={13} /></IconButton>
    </div>
  )
}

/** Resources DevForge found but the user hid, with a way back */
function HiddenList({ items, onShow }: { items: { ref: string; label: string }[]; onShow: (ref: string) => void }) {
  const { t } = useI18n()
  if (!items.length) return null
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs tracking-widest text-fg-muted uppercase">{t.hub.hiddenTitle}</span>
      {items.map(i => (
        <div key={i.ref} className="flex items-center gap-2 text-sm text-fg-secondary">
          <span className="min-w-0 flex-1 truncate">{i.label}</span>
          <button onClick={() => onShow(i.ref)} className="text-xs font-medium text-accent hover:underline">{t.hub.showAgain}</button>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { t, lang } = useI18n()
  const h = t.hub
  const toast = useToast()
  const { runScript } = useConsole()
  const { setOpen: openForgy } = useAssistant()

  const tab: Tab = TABS.includes(params.get('tab') as Tab) ? params.get('tab') as Tab : 'overview'
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  const [hub, setHub] = useState<ProjectHub | null>(null)
  const [git, setGit] = useState<GitRepoDetails | null>(null)
  const [docker, setDocker] = useState<DockerOverview | null>(null)
  const [listening, setListening] = useState<ListeningPort[]>([])
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [domains, setDomains] = useState<LocalDomain[]>([])
  const [scripts, setScripts] = useState<Record<string, string>>({})
  /** Deploy target whose .env sync panel is open */
  const [envSync, setEnvSync] = useState<string | null>(null)
  const ide = usePreferredIde()
  const [busy, setBusy] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  /** The linked database shown in the Database tab */
  const [shownDb, setShownDb] = useState<string | null>(null)
  const [newLog, setNewLog] = useState('')
  // The terminal stays once opened: its shells survive a trip to another tab
  const [termOpened, setTermOpened] = useState(tab === 'terminal')
  useEffect(() => { if (tab === 'terminal') setTermOpened(true) }, [tab])

  const loadHub = useCallback(() => {
    if (!id) return
    window.devforge.hub.get(id).then(setHub).catch(() => navigate('/projects'))
  }, [id, navigate])
  const loadGit = useCallback((fresh = false) => { if (hub) window.devforge.git.details(hub.project.path, fresh).then(setGit).catch(() => setGit(null)) }, [hub])
  const loadDocker = useCallback(() => { window.devforge.docker.overview().then(setDocker).catch(() => {}) }, [])

  useEffect(() => {
    loadHub()
    // Opening a project makes it the active one (Forgy, widget, home)
    if (id) window.devforge.hub.setActive(id).catch(() => {})
  }, [id, loadHub])

  useEffect(() => {
    if (!hub) return
    loadGit()
    loadDocker()
    window.devforge.getListeningPorts().then(setListening).catch(() => {})
    window.devforge.db.list().then(setConnections).catch(() => {})
    window.devforge.domains.list().then(setDomains).catch(() => {})
    window.devforge.getProjectScripts(hub.project.path).then(setScripts).catch(() => {})
  }, [hub, loadGit, loadDocker])

  const compose = useMemo(() => docker?.compose.find(c => (hub?.composeDir && c.dir === hub.composeDir) || c.name === hub?.composeName) ?? null, [docker, hub])

  if (!hub) return <div className="p-8"><Spinner /></div>
  const p = hub.project

  const link = async (kind: LinkKind, ref: string, linked: boolean) => {
    try { setHub(await window.devforge.hub.link(p.id, kind, ref, linked)) } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  const gitAction = async (action: 'pull' | 'push' | 'fetch') => {
    setBusy(action)
    try {
      const r = await window.devforge.git[action](p.path)
      toast.show({ tone: r.ok ? 'success' : 'error', title: `${p.name} · ${h[action]}`, description: r.ok ? undefined : r.output.slice(-400) })
    } finally { setBusy(null); loadGit(true) }
  }

  /** v3.5: the project's own IDE (a group: its projects' too) */
  async function saveProject(patch: { ide?: DefaultIDE; subIdes?: Record<string, DefaultIDE> }) {
    await window.devforge.saveProject({ ...p, ...patch })
    loadHub()
  }

  async function toggleFavorite() {
    await window.devforge.toggleFavorite(p.id)
    loadHub()
  }

  async function remove() {
    if (!window.confirm(h.removeConfirm.replace('{name}', p.name))) return
    await window.devforge.removeProject(p.id)
    navigate('/projects')
  }

  async function freePort(port: ListeningPort) {
    if (port.pid === null) return
    try {
      await window.devforge.freePort(port.port, port.pid)
      toast.show({ tone: 'success', title: t.ports.freed.replace('{port}', String(port.port)) })
    } catch (err) {
      toast.show({ tone: 'error', title: t.ports.freeFailed.replace('{port}', String(port.port)), description: errorText(err) })
    } finally { window.devforge.getListeningPorts().then(setListening).catch(() => {}) }
  }

  const scriptList = Object.entries(scripts)
  const listenerOf = (port: number) => listening.find(l => l.port === port)
  const unlinkedDbs = connections.filter(c => !hub.databases.some(d => d.id === c.id))
  const unlinkedDomains = domains.filter(d => !hub.domains.some(x => x.id === d.id))
  const counts: Partial<Record<Tab, number>> = {
    database: hub.databases.length, logs: hub.logs.length, ports: hub.ports.length + hub.domains.length,
    deploy: hub.deployTargets.length, env: hub.envFiles.length, git: git?.changes || undefined
  }

  // ─── Tabs content ───────────────────────────────────────────────────────────

  const gitSummary = !git ? <Spinner /> : !git.isRepo ? <Muted>{h.gitNone}</Muted> : (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2 font-mono text-xs text-fg-secondary"><GitBranch size={14} /> {git.branch}</div>
      <div className="flex flex-wrap gap-1.5">
        {git.changes > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 font-mono text-[11px] text-warning">{h.gitChanges.replace('{n}', String(git.changes))}</span>}
        {git.ahead > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] text-accent">{h.gitAhead.replace('{n}', String(git.ahead))}</span>}
        {git.behind > 0 && <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-[11px] text-fg-secondary">{h.gitBehind.replace('{n}', String(git.behind))}</span>}
        {!git.changes && !git.ahead && !git.behind && <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[11px] text-success">{h.gitClean}</span>}
      </div>
      {git.lastCommit && <p className="truncate text-xs text-fg-muted">{git.lastCommit.message} · {formatRelative(git.lastCommit.date, lang)}</p>}
    </div>
  )

  const gitButtons = git?.isRepo && (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setCommitting(true)} disabled={!git.changes}>{h.commit}</Button>
      <Button size="sm" variant="secondary" loading={busy === 'pull'} disabled={!git.hasUpstream} onClick={() => gitAction('pull')}>{h.pull}</Button>
      <Button size="sm" variant="secondary" loading={busy === 'push'} disabled={!git.ahead} onClick={() => gitAction('push')}>{h.push}</Button>
      <Button size="sm" variant="ghost" loading={busy === 'fetch'} disabled={!git.hasUpstream} onClick={() => gitAction('fetch')}>{h.fetch}</Button>
    </div>
  )

  const composeSummary = !hub.composeDir ? <Muted>{h.composeNone}</Muted> : !docker ? <Spinner /> : !docker.available ? <Muted>{h.composeOff}</Muted> : (
    <div className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-fg">{hub.composeName}</span>
      {compose && compose.total > 0
        ? <span className={cn('font-mono text-xs', compose.running ? 'text-success' : 'text-fg-muted')}>{t.home.composeOnline.replace('{r}', String(compose.running)).replace('{t}', String(compose.total))}</span>
        : <span className="font-mono text-xs text-fg-muted">{h.composeNever}</span>}
    </div>
  )

  // The database open in the tab, and the way to the full page (which leads back here)
  const dbId = hub.databases.some(d => d.id === shownDb) ? shownDb : hub.databases[0]?.id ?? null
  const dbConn = connections.find(c => c.id === dbId)
  const openDbPage = (id: string) => navigate(`/database?conn=${encodeURIComponent(id)}&from=${encodeURIComponent(p.id)}`)

  const databaseList = (
    <Card className="overflow-hidden">
      {hub.databases.length === 0 && <div className="p-[18px]"><Muted>{h.dbNone}</Muted></div>}
      {hub.databases.map(d => (
        <LinkRow key={d.id} origin={d.origin} onUntie={() => link('databases', d.id, false)}
          actions={<Button size="sm" variant={d.id === dbId ? 'primary' : 'secondary'} aria-pressed={d.id === dbId} onClick={() => setShownDb(d.id)}>{h.dbShow}</Button>}>
          <div className="truncate font-medium text-fg">{d.name}</div>
          <div className="font-mono text-xs text-fg-muted">{d.type}</div>
        </LinkRow>
      ))}
    </Card>
  )

  const logList = (
    <Card className="overflow-hidden">
      {hub.logs.length === 0 && <div className="p-[18px]"><Muted>{h.logsNone}</Muted></div>}
      {hub.logs.map(l => (
        <LinkRow key={l.path} origin={l.origin} onUntie={() => link('logs', l.path, false)}
          actions={<Button size="sm" variant="secondary" onClick={() => navigate(`/logs?file=${encodeURIComponent(l.path)}`)}>{h.follow}</Button>}>
          <div className="truncate font-medium text-fg" title={l.path}>{fileName(l.path)}</div>
          <div className="truncate font-mono text-xs text-fg-muted">{l.size ? `${formatSize(l.size)} · ` : ''}{l.modifiedAt ? formatRelative(l.modifiedAt, lang) : l.path}</div>
        </LinkRow>
      ))}
    </Card>
  )

  const content: Record<Tab, ReactNode> = {
    overview: (
      <div className="flex flex-col gap-5">
      {p.framework === 'group' && <GroupProjects group={p} ide={ide} onSave={saveProject} />}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Tile i={1} title="Git" icon={<GitBranch size={16} />} onSee={() => setTab('git')}>{gitSummary}{gitButtons}</Tile>
        <Tile i={2} title="Docker" icon={<Container size={16} />} onSee={hub.composeDir ? () => setTab('docker') : undefined}>{composeSummary}</Tile>
        <Tile i={3} title={h.tabs.env} icon={<FileKey2 size={16} />} onSee={() => setTab('env')}>
          {hub.envFiles.length === 0 ? <Muted>{t.envFiles.emptyTitle}</Muted> : (
            <div className="flex flex-wrap gap-1.5">
              {hub.envFiles.map(f => <span key={f.name} className="rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-fg-secondary">{f.name} · {h.envKeys.replace('{n}', String(f.keys))}</span>)}
            </div>
          )}
        </Tile>
        <Tile i={4} title={h.tabs.database} icon={<Database size={16} />} onSee={() => setTab('database')}>
          {hub.databases.length === 0 ? <Muted>{h.none}</Muted> : hub.databases.map(d => (
            <button key={d.id} onClick={() => { setShownDb(d.id); setTab('database') }} className="flex items-center gap-2 text-left text-sm text-fg hover:text-accent">
              <span className="flex-1 truncate">{d.name}</span><span className="font-mono text-xs text-fg-muted">{d.type}</span>
            </button>
          ))}
        </Tile>
        <Tile i={5} title={h.tabs.logs} icon={<ScrollText size={16} />} onSee={() => setTab('logs')}>
          {hub.logs.length === 0 ? <Muted>{h.none}</Muted> : hub.logs.slice(0, 3).map(l => (
            <button key={l.path} onClick={() => navigate(`/logs?file=${encodeURIComponent(l.path)}`)} className="flex items-center gap-2 text-left text-sm text-fg hover:text-accent">
              <span className="flex-1 truncate">{fileName(l.path)}</span>{l.modifiedAt && <span className="font-mono text-xs text-fg-muted">{formatRelative(l.modifiedAt, lang)}</span>}
            </button>
          ))}
        </Tile>
        <Tile i={6} title={h.tabs.ports} icon={<Wifi size={16} />} onSee={() => setTab('ports')}>
          {hub.ports.length === 0 && hub.domains.length === 0 ? <Muted>{h.none}</Muted> : (
            <div className="flex flex-wrap gap-1.5">
              {hub.ports.map(x => (
                <span key={x.port} className={cn('rounded-lg border px-2.5 py-1 font-mono text-xs', listenerOf(x.port) ? 'border-success/30 bg-success-soft text-success' : 'border-line bg-elevated text-fg-secondary')}>{x.port}</span>
              ))}
              {hub.domains.map(d => <span key={d.id} className="rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-fg-secondary">{d.domain}</span>)}
            </div>
          )}
        </Tile>
        <Tile i={7} title={h.tabs.deploy} icon={<Rocket size={16} />} onSee={hub.deployTargets.length ? () => setTab('deploy') : undefined}>
          {hub.deployTargets.length === 0 ? <Muted>{h.deployNone}</Muted> : hub.deployTargets.map(d => <span key={d.id} className="text-sm text-fg">{d.name}</span>)}
        </Tile>
        {scriptList.length > 0 && (
          <Tile i={8} title={h.scripts} icon={<Play size={16} />}>
            <div className="flex flex-wrap gap-1.5">
              {scriptList.slice(0, 8).map(([name, cmd]) => (
                <button key={name} title={cmd} onClick={() => runScript(p.path, name, p.packageManager, p.name)}
                  className="flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-fg hover:bg-hover">
                  <Play size={11} className="text-success" /> {name}
                </button>
              ))}
            </div>
          </Tile>
        )}
        <Tile i={9} title={h.info} icon={<FolderOpen size={16} />}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-fg-muted">{h.framework}</dt><dd className="truncate text-fg">{FRAMEWORK_LABEL[p.framework] ?? p.framework}</dd>
            <dt className="text-fg-muted">{h.packageManager}</dt><dd className="text-fg">{p.packageManager}</dd>
            <dt className="text-fg-muted">{h.created}</dt><dd className="text-fg">{formatDate(p.createdAt, lang)}</dd>
            <dt className="text-fg-muted">{h.lastOpened}</dt><dd className="text-fg">{formatDate(p.lastOpenedAt, lang)}</dd>
            <dt className="self-center text-fg-muted">IDE</dt><dd><IdeSelect ide={ide} value={p.ide} label={h.projectIde} onChange={next => saveProject({ ide: next })} /></dd>
          </dl>
        </Tile>
      </div>
      </div>
    ),

    git: (
      <Card className="flex flex-col gap-4 p-[18px]">
        {gitSummary}
        {gitButtons}
      </Card>
    ),

    docker: !hub.composeDir ? <EmptyState icon={<Container size={32} />} title={h.composeNone} />
      : !docker ? <Spinner /> : !docker.available ? <EmptyState icon={<Container size={32} />} title={h.composeOff} />
      : compose ? (
        <ComposeDetail
          p={compose}
          containers={docker.containers.filter(c => c.composeProject === compose.name)}
          busy={new Set(busy ? [busy] : [])}
          onAction={async a => {
            setBusy(compose.name)
            try {
              const r = await window.devforge.docker.compose({ name: compose.name, configFiles: compose.configFiles, dir: compose.dir }, a)
              if (!r.ok) toast.show({ tone: 'error', title: `${compose.name} · ${a}`, description: r.output.slice(-400) })
            } finally { setBusy(null); loadDocker() }
          }}
          onContainer={async (c, a) => { setBusy(c.id); try { await window.devforge.docker.container(c.id, a) } finally { setBusy(null); loadDocker() } }}
        />
      ) : <Spinner />,

    env: <ProjectEnvEditor projectPath={p.path} onEnvChange={() => {}} />,

    packages: <PackagesPanel projectId={p.id} />,

    database: (
      <div className="flex flex-col gap-4">
        {databaseList}
        {unlinkedDbs.length > 0 && (
          <label className="flex items-center gap-2 self-start">
            <span className="sr-only">{h.dbLink}</span>
            <select value="" onChange={e => e.target.value && link('databases', e.target.value, true)}
              className="h-9 rounded-[9px] border border-line bg-canvas px-3 text-sm text-fg-secondary outline-none">
              <option value="">{h.dbLink}</option>
              {unlinkedDbs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </label>
        )}
        <HiddenList items={hub.hidden.databases.map(ref => ({ ref, label: connections.find(c => c.id === ref)?.name ?? ref }))} onShow={ref => link('databases', ref, true)} />
        {/* The database itself, right here: tables, rows, structure, SQL */}
        {dbConn && (
          <div className="h-[640px] overflow-hidden rounded-[14px] border border-line">
            <DbExplorer key={dbConn.id} conn={dbConn}
              actions={<Button size="sm" variant="ghost" onClick={() => openDbPage(dbConn.id)}><Maximize2 size={13} /> {t.database.openFull}</Button>} />
          </div>
        )}
      </div>
    ),

    logs: (
      <div className="flex flex-col gap-4">
        {logList}
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (newLog.trim()) { link('logs', newLog.trim(), true); setNewLog('') } }}>
          <label className="flex-1">
            <span className="sr-only">{h.logsAddPlaceholder}</span>
            <input value={newLog} onChange={e => setNewLog(e.target.value)} placeholder={h.logsAddPlaceholder}
              className="h-9 w-full rounded-[9px] border border-line bg-canvas px-3 font-mono text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent/60" />
          </label>
          <Button type="submit" variant="secondary" disabled={!newLog.trim()}>{h.tie}</Button>
        </form>
        <HiddenList items={hub.hidden.logs.map(ref => ({ ref, label: fileName(ref) }))} onShow={ref => link('logs', ref, true)} />
      </div>
    ),

    ports: (
      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          <h2 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{h.portsTitle}</h2>
          {hub.ports.length === 0 && <div className="px-[18px] pb-4"><Muted>{h.portsNone}</Muted></div>}
          {hub.ports.map(x => {
            const l = listenerOf(x.port)
            return (
              <div key={x.port} className="group flex items-center gap-3 border-t border-line-subtle px-[18px] py-3">
                <button onClick={() => window.devforge.openExternal(`http://localhost:${x.port}`)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-fg hover:text-accent">
                  {x.port} <ExternalLink size={10} className="opacity-50" />
                </button>
                <span className="flex-1 font-mono text-xs text-fg-muted">{x.source}</span>
                <span className={cn('font-mono text-xs', l ? 'text-success' : 'text-fg-muted')}>{l ? h.listening.replace('{name}', l.processName) : h.notListening}</span>
                {l && l.pid !== null && l.pid > 4 && (
                  <button onClick={() => freePort(l)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-2.5 text-xs font-medium text-danger opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-danger hover:text-white">
                    <XCircle size={12} /> {h.free}
                  </button>
                )}
              </div>
            )
          })}
        </Card>
        <Card className="overflow-hidden">
          <h2 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{h.domainsTitle}</h2>
          {hub.domains.length === 0 && <div className="px-[18px] pb-4"><Muted>{h.domainsNone}</Muted></div>}
          {hub.domains.map(d => (
            <LinkRow key={d.id} origin={d.origin} onUntie={() => link('domains', d.id, false)}
              actions={<Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(`http://${d.domain}`)}><Globe size={13} /> {h.open}</Button>}>
              <div className="font-mono text-sm text-fg">{d.domain}</div>
              <div className="font-mono text-xs text-fg-muted">→ localhost:{d.port}</div>
            </LinkRow>
          ))}
        </Card>
        {unlinkedDomains.length > 0 && (
          <label className="flex items-center gap-2 self-start">
            <span className="sr-only">{h.domainLink}</span>
            <select value="" onChange={e => e.target.value && link('domains', e.target.value, true)}
              className="h-9 rounded-[9px] border border-line bg-canvas px-3 text-sm text-fg-secondary outline-none">
              <option value="">{h.domainLink}</option>
              {unlinkedDomains.map(d => <option key={d.id} value={d.id}>{d.domain} → {d.port}</option>)}
            </select>
          </label>
        )}
        <HiddenList items={hub.hidden.domains.map(ref => ({ ref, label: domains.find(d => d.id === ref)?.domain ?? ref }))} onShow={ref => link('domains', ref, true)} />
      </div>
    ),

    deploy: (
      <Card className="overflow-hidden">
        {hub.deployTargets.length === 0 && <div className="p-[18px]"><Muted>{h.deployNone}</Muted></div>}
        {hub.deployTargets.map(d => (
          <div key={d.id} className="border-t border-line-subtle first:border-t-0">
            <div className="flex items-center gap-3 px-[18px] py-3">
              <Rocket size={15} className="text-fg-muted" />
              <span className="flex-1 font-medium text-fg">{d.name}</span>
              <Button size="sm" variant={envSync === d.id ? 'primary' : 'ghost'} aria-expanded={envSync === d.id} onClick={() => setEnvSync(s => (s === d.id ? null : d.id))}>
                <FileKey2 size={13} /> {h.envSync.open}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/deploy')}>{h.deployOpen}</Button>
            </div>
            {envSync === d.id && <EnvSyncPanel targetId={d.id} envFiles={hub.envFiles.map(f => f.name)} />}
          </div>
        ))}
      </Card>
    ),

    vercel: hub.vercel ? <VercelPanel projectId={p.id} /> : null,

    github: hub.github ? <GithubPanel projectPath={p.path} repo={hub.github} /> : null,
    symfony: p.framework === 'symfony' ? <SymfonyPanel projectPath={p.path} /> : null,
    nextjs: p.framework === 'nextjs' ? <NextPanel projectPath={p.path} /> : null,
    laravel: p.framework === 'laravel' ? <LaravelPanel projectPath={p.path} /> : null,
    // Drawn below, kept mounted
    terminal: null,

    files: (
      <div className="flex flex-wrap gap-4">
        <Card className="h-[520px] min-w-[280px] flex-[1_1_320px] overflow-hidden"><FileTree rootPath={p.path} /></Card>
        {scriptList.length > 0 && (
          <Card className="min-w-[280px] flex-[1_1_320px] self-start overflow-hidden">
            <h2 className="px-[18px] pt-4 pb-2 text-md font-semibold text-fg">{h.scripts}</h2>
            {scriptList.map(([name, cmd]) => (
              <div key={name} className="flex items-center gap-3 border-t border-line-subtle px-[18px] py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-fg">{name}</div>
                  <div className="truncate font-mono text-xs text-fg-muted">{cmd}</div>
                </div>
                <IconButton title={`${h.run} ${name}`} onClick={() => runScript(p.path, name, p.packageManager, p.name)} className="text-success hover:bg-success-soft hover:text-success"><Play size={12} /></IconButton>
              </div>
            ))}
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="df-rise mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-8 pt-6 pb-24">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <IconButton title={h.back} onClick={() => navigate(-1)}><ArrowLeft size={15} /></IconButton>
        <ProjectIcon framework={p.framework} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-[26px] leading-tight font-semibold tracking-[-.02em] text-fg">{p.name}</h1>
            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-medium text-accent">{h.active}</span>
          </div>
          <button onClick={() => window.devforge.openDirectory(p.path)} title={h.openFolder} className="max-w-full truncate font-mono text-xs text-fg-muted hover:text-accent">{p.path}</button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton title={h.favorite} onClick={toggleFavorite} className={cn(p.favorite && 'text-warning hover:text-warning')}><Star size={15} fill={p.favorite ? 'currentColor' : 'none'} /></IconButton>
          {ide.labelFor(p.ide) && <IconButton title={`${h.openIde} · ${ide.labelFor(p.ide)}`} onClick={() => ide.open(p.path, p.ide)}><Code2 size={15} /></IconButton>}
          <IconButton title={h.openTerminal} onClick={() => window.devforge.openTerminal(p.path)}><Terminal size={15} /></IconButton>
          <IconButton title={h.remove} tone="danger" onClick={remove}><Trash2 size={15} /></IconButton>
        </div>
        <Button variant="secondary" onClick={() => openForgy(true)} className="border-forgy/30 text-forgy"><Bot size={15} /> {h.askForgy}</Button>
      </header>

      {/* Tabs, underlined */}
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.filter(x => (x !== 'vercel' || hub.vercel) && (x !== 'github' || hub.github) && (x !== 'packages' || hub.manifests.length > 0) && (x !== 'symfony' && x !== 'nextjs' && x !== 'laravel' || p.framework === x)).map(x => (
          <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}
            className={cn('flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-3 text-base font-medium transition-colors',
              tab === x ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg')}>
            {h.tabs[x]}
            {!!counts[x] && <span className="rounded-full bg-elevated px-1.5 font-mono text-[10.5px] text-fg-muted">{counts[x]}</span>}
          </button>
        ))}
      </div>

      {tab !== 'terminal' && <div key={tab} className="df-rise">{content[tab]}</div>}
      {termOpened && (
        <div key={p.path} className={cn(tab !== 'terminal' && 'hidden')}>
          <TerminalTabs cwd={p.path} withSsh={false} className="h-[600px] overflow-hidden rounded-[14px] border border-line" />
        </div>
      )}

      {committing && git && (
        <CommitModal project={p} canPush={git.hasUpstream} onClose={() => setCommitting(false)} onDone={() => { setCommitting(false); loadGit(true) }} />
      )}
    </div>
  )
}
