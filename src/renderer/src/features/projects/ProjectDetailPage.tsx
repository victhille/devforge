import { useCallback, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { CardGridSkeleton, CardSkeleton, Skeleton } from '@renderer/components/ui/Skeleton'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Code2, Container, Database, ExternalLink, FileKey2, FolderOpen, GitBranch, Globe, Play, Rocket, ScrollText,
  Star, Terminal, Trash2, X, XCircle, Maximize2, LayoutTemplate, Bot, FlaskConical, CloudUpload } from 'lucide-react'
import { NO_CONNECTIONS, useDbConnections, useNoteCounts } from '@renderer/hooks/useLiveData'
import type { DefaultIDE, DockerOverview, GitRepoDetails, LinkKind, ListeningPort, LocalDomain, ProjectHub, TestRun, TestRunnerInfo } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import AskForgy from '@renderer/features/assistant/AskForgy'
import { cn } from '@renderer/lib/cn'
import { formatDate, formatRelative, formatSize } from '@renderer/lib/format'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Badge from '@renderer/components/ui/Badge'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import { ComposeDetail } from '@renderer/features/docker/ComposeDetail'
import ProjectEnvEditor from '@renderer/features/envfiles/ProjectEnvEditor'
import ProjectIcon from './components/ProjectIcon'
import SaveTemplateDialog from './SaveTemplateDialog'
import TabBar from './components/TabBar'
import FilesGitPanel from './FilesGitPanel'
import VercelPanel from './VercelPanel'
import EnvSyncPanel from './EnvSyncPanel'
import GithubPanel from './GithubPanel'
import SymfonyPanel from './symfony/SymfonyPanel'
import NextPanel from './nextjs/NextPanel'
import LaravelPanel from './laravel/LaravelPanel'
import TerminalTabs, { type ScriptRequest } from '@renderer/features/terminal/TerminalTabs'
import { scriptCommand } from '@shared/lib/terminalSuggest'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import ScriptsCard, { ScriptList } from './components/ScriptsCard'
import { TEST_TOOL } from './testTools'
import DbExplorer from '@renderer/features/database/DbExplorer'
import ProjectModels from '@renderer/features/modeling/ProjectModels'
import PackagesPanel from './PackagesPanel'
import TestsPanel from './TestsPanel'
import NotesPanel from './NotesPanel'
import GroupProjects from './GroupProjects'
import IdeSelect from './components/IdeSelect'
import { usePreferredIde } from '@renderer/lib/ide'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'

type Tab = 'overview' | 'files' | 'terminal' | 'tests' | 'packages' | 'notes' | 'symfony' | 'nextjs' | 'laravel' | 'docker' | 'env' | 'database' | 'logs' | 'github' | 'modeling' | 'ports' | 'deploy' | 'vercel'
const TABS: Tab[] = ['overview', 'files', 'terminal', 'tests', 'packages', 'notes', 'symfony', 'nextjs', 'laravel', 'docker', 'env', 'database', 'logs', 'github', 'modeling', 'ports', 'deploy', 'vercel']

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p

// ─── Small pieces ─────────────────────────────────────────────────────────────

/** A card of the overview, as in the mock-up: icon, title, a link (« Voir ») or a state on the right */
function Tile({ title, icon, onSee, seeLabel, aside, i, className, children }: {
  title: string; icon: ReactNode; onSee?: () => void; seeLabel?: string; aside?: ReactNode; i: number; className?: string; children: ReactNode
}) {
  const { t } = useI18n()
  const id = useId()
  return (
    <Card role="region" aria-labelledby={id} className={cn('df-rise flex min-w-0 flex-col gap-3.5 p-4.5', className)} style={{ '--i': i } as CSSProperties}>
      <div className="flex min-h-6 items-center gap-2.5">
        <span aria-hidden className="text-fg-secondary">{icon}</span>
        <h2 id={id} className="flex-1 truncate font-display text-md font-bold tracking-[-.01em] text-fg">{title}</h2>
        {aside}
        {onSee && <button type="button" onClick={onSee} aria-describedby={id} className="text-sm font-semibold text-accent hover:text-accent-hover">{seeLabel ?? t.hub.see}</button>}
      </div>
      {children}
    </Card>
  )
}

/** A row of an overview card: a thin line between rows */
const ROW = 'flex min-h-9 min-w-0 items-center gap-2.5 border-b border-line-subtle last:border-b-0'

function Origin({ origin }: { origin: 'auto' | 'manual' }) {
  const { t } = useI18n()
  return <Badge>{origin === 'auto' ? t.hub.auto : t.hub.manual}</Badge>
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-sm text-fg-muted">{children}</p>

/** A linked resource row: label, origin, actions, and untie */
function LinkRow({ children, origin, onUntie, actions }: { children: ReactNode; origin: 'auto' | 'manual'; onUntie: () => void; actions?: ReactNode }) {
  const { t } = useI18n()
  return (
    <div className="group flex items-center gap-3 border-t border-line-subtle px-4.5 py-3 first:border-t-0">
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
      <span className="text-xs font-semibold tracking-[.04em] text-fg-muted uppercase">{t.hub.hiddenTitle}</span>
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
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Git lives with the files now: an old link to its tab opens them
  const asked = params.get('tab') === 'git' ? 'files' : params.get('tab')
  const tab: Tab = TABS.includes(asked as Tab) ? asked as Tab : 'overview'
  const setTab = (next: Tab) => setParams(next === 'overview' ? {} : { tab: next }, { replace: true })

  const [hub, setHub] = useState<ProjectHub | null>(null)
  const [git, setGit] = useState<GitRepoDetails | null>(null)
  const [docker, setDocker] = useState<DockerOverview | null>(null)
  const [listening, setListening] = useState<ListeningPort[]>([])
  // v4.2: the kept list of connections
  const connections = useDbConnections().data ?? NO_CONNECTIONS
  const [domains, setDomains] = useState<LocalDomain[]>([])
  const [scripts, setScripts] = useState<Record<string, string>>({})
  /** Deploy target whose .env sync panel is open */
  const [envSync, setEnvSync] = useState<string | null>(null)
  const ide = usePreferredIde()
  const [busy, setBusy] = useState<string | null>(null)
  /** Changes on each Git action and commit: Files and Git reads its view again */
  const [gitRev, setGitRev] = useState(0)
  /** The linked database shown in the Database tab */
  const [shownDb, setShownDb] = useState<string | null>(null)
  const [newLog, setNewLog] = useState('')
  /** v3.7: the project's test tools (no tool, no Tests tab) */
  const [testRunners, setTestRunners] = useState<TestRunnerInfo[]>([])
  /** The last test run, on the overview */
  const [testRun, setTestRun] = useState<TestRun | null>(null)
  /** The boxes left to check in its notes, on the Notes tab */
  const noteCounts = useNoteCounts().data
  // The terminal stays once opened: its shells survive a trip to another tab
  const [termOpened, setTermOpened] = useState(tab === 'terminal')
  useEffect(() => { if (tab === 'terminal') setTermOpened(true) }, [tab])
  // The project's scripts run in tabs of its terminal: the page sends them, and follows which run
  const [scriptRequest, setScriptRequest] = useState<ScriptRequest | null>(null)
  const [scriptRuns, setScriptRuns] = useState<Record<string, number | null>>({})

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
    window.devforge.domains.list().then(setDomains).catch(() => {})
    window.devforge.getProjectScripts(hub.project.path).then(setScripts).catch(() => {})
  }, [hub, loadGit, loadDocker])

  const projectPath = hub?.project.path
  useEffect(() => {
    if (!projectPath) return
    window.devforge.tests.detect(projectPath).then(setTestRunners).catch(() => setTestRunners([]))
  }, [projectPath])
  const firstRunner = testRunners[0]?.runner
  useEffect(() => {
    if (!projectPath || !firstRunner) return
    window.devforge.tests.last(projectPath, firstRunner).then(r => setTestRun(r ?? null)).catch(() => setTestRun(null))
  }, [projectPath, firstRunner, tab])

  const compose = useMemo(() => docker?.compose.find(c => (hub?.composeDir && c.dir === hub.composeDir) || c.name === hub?.composeName) ?? null, [docker, hub])

  if (!hub) return (
    <div className="df-mockup mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-9 pt-6.5 pb-24">
      <div className="flex items-center gap-3.5"><Skeleton className="size-12 rounded-control" /><div className="flex flex-col gap-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-72" /></div></div>
      <Skeleton className="h-9 w-full max-w-[720px]" />
      <CardGridSkeleton cards={3} />
    </div>
  )
  const p = hub.project

  const link = async (kind: LinkKind, ref: string, linked: boolean) => {
    try { setHub(await window.devforge.hub.link(p.id, kind, ref, linked)) } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  const gitAction = async (action: 'pull' | 'push' | 'fetch') => {
    setBusy(action)
    try {
      const r = await window.devforge.git[action](p.path)
      toast.show({ tone: r.ok ? 'success' : 'error', title: `${p.name} · ${h[action]}`, description: r.ok ? undefined : r.output.slice(-400) })
    } finally { setBusy(null); loadGit(true); setGitRev(r => r + 1) }
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
    if (!(await confirmDialog(h.removeConfirm.replace('{name}', p.name), { danger: true }))) return
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
  /** The port the project listens on (its dev server), shown beside a script that runs */
  const livePort = hub.ports.find(x => listenerOf(x.port))?.port ?? null
  const unlinkedDbs = connections.filter(c => !hub.databases.some(d => d.id === c.id))
  const unlinkedDomains = domains.filter(d => !hub.domains.some(x => x.id === d.id))
  const counts: Partial<Record<Tab, number>> = {
    notes: noteCounts?.[p.id] ?? 0,
    database: hub.databases.length, logs: hub.logs.length, ports: hub.ports.length + hub.domains.length,
    deploy: hub.deployTargets.length, env: hub.envFiles.length, files: git?.changes || undefined
  }
  const runScriptHere = (name: string) => {
    setTermOpened(true)
    setScriptRequest({ seq: Date.now(), action: 'run', name, cmd: scriptCommand(p.packageManager, name) })
  }
  const stopScript = (name: string) => setScriptRequest({ seq: Date.now(), action: 'stop', name, cmd: '' })

  // ─── Tabs content ───────────────────────────────────────────────────────────

  const gitSummary = !git ? <Skeleton className="h-3.5 w-40" /> : !git.isRepo ? <Muted>{h.gitNone}</Muted> : (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-fg">{git.branch}</span>
        {git.changes > 0 && <Badge color="warning">{h.gitChanges.replace('{n}', String(git.changes))}</Badge>}
        {git.ahead > 0 && <Badge color="accent">{h.gitAhead.replace('{n}', String(git.ahead))}</Badge>}
        {git.behind > 0 && <Badge>{h.gitBehind.replace('{n}', String(git.behind))}</Badge>}
        {!git.changes && !git.ahead && !git.behind && <Badge color="success">{h.gitClean}</Badge>}
      </div>
      {git.lastCommit && <p className="truncate text-sm text-fg-secondary" title={git.lastCommit.message}>{git.lastCommit.message} · {formatRelative(git.lastCommit.date, lang)}</p>}
    </div>
  )

  const gitButtons = git?.isRepo && (
    <div className="mt-auto flex flex-wrap gap-2">
      <Button size="sm" onClick={() => setTab('files')} disabled={!git.changes}>{h.commit}</Button>
      <Button size="sm" variant="ghost" loading={busy === 'pull'} disabled={!git.hasUpstream} onClick={() => gitAction('pull')}>{h.pull}</Button>
      <Button size="sm" variant="ghost" loading={busy === 'push'} disabled={!git.ahead} onClick={() => gitAction('push')}>{h.push}</Button>
    </div>
  )

  // Tests: what passed last time, failures as a badge, a meter, the tool and when
  const totals = testRun?.totals
  const ran = totals ? totals.passed + totals.failed + totals.skipped : 0
  const testsSummary = !testRun || !totals ? (
    <div className="flex flex-col items-start gap-2.5">
      <Muted>{h.testsNever}</Muted>
      <Button size="sm" variant="secondary" onClick={() => setTab('tests')}><Play size={13} /> {h.testsRun}</Button>
    </div>
  ) : (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-end gap-2">
        <span className="font-display text-[26px] leading-none font-bold tracking-[-.02em] text-fg">{totals.passed}</span>
        <span className="text-sm text-fg-muted">{h.testsPassed}</span>
        <span className="flex-1" />
        <Badge color={totals.failed ? 'danger' : 'success'}>{h.testsFailed.replace('{n}', String(totals.failed))}</Badge>
      </div>
      <div role="meter" aria-label={h.testsPassed} aria-valuenow={totals.passed} aria-valuemin={0} aria-valuemax={ran || 1} className="h-1.5 overflow-hidden rounded-full bg-active">
        <div className={cn('h-full rounded-full', totals.failed ? 'bg-danger' : 'bg-success')} style={{ width: `${ran ? (totals.passed / ran) * 100 : 0}%` }} />
      </div>
      <p className="truncate text-xs text-fg-muted">
        {[TEST_TOOL[testRun.runner], h.testsLast.replace('{when}', formatRelative(testRun.startedAt, lang)), `${(testRun.durationMs / 1000).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })} s`].join(' · ')}
      </p>
    </div>
  )

  const composeSummary = !hub.composeDir ? <Muted>{h.composeNone}</Muted> : !docker ? <Skeleton className="h-3.5 w-40" /> : !docker.available ? <Muted>{h.composeOff}</Muted> : (
    <div className="flex flex-col gap-3">
      <p className="truncate font-mono text-sm text-fg-secondary">
        {compose && compose.total > 0
          ? docker.containers.filter(c => c.composeProject === compose.name).map(c => c.name.replace(new RegExp(`^${compose.name}[-_]`), '').replace(/[-_]\d+$/, '')).join(' · ')
          : h.composeNever}
      </p>
      <Button size="sm" variant="secondary" className="self-start" onClick={() => setTab('docker')}>{h.composeOpen}</Button>
    </div>
  )
  const composeBadge = compose && compose.total > 0 && docker?.available
    ? <Badge color={compose.running ? 'success' : 'default'}>{t.home.composeOnline.replace('{r}', String(compose.running)).replace('{t}', String(compose.total))}</Badge>
    : undefined

  // The database open in the tab, and the way to the full page (which leads back here)
  const dbId = hub.databases.some(d => d.id === shownDb) ? shownDb : hub.databases[0]?.id ?? null
  const dbConn = connections.find(c => c.id === dbId)
  const openDbPage = (id: string) => navigate(`/database?conn=${encodeURIComponent(id)}&from=${encodeURIComponent(p.id)}`)

  const databaseList = (
    <Card className="overflow-hidden">
      {hub.databases.length === 0 && <div className="p-4.5"><Muted>{h.dbNone}</Muted></div>}
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
      {hub.logs.length === 0 && <div className="p-4.5"><Muted>{h.logsNone}</Muted></div>}
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Tile className="xl:col-span-4" i={1} title="Git" icon={<GitBranch size={16} />} onSee={() => setTab('files')}>{gitSummary}{gitButtons}</Tile>
        <Tile className="xl:col-span-4" i={2} title={h.scripts} icon={<Play size={16} />} onSee={() => setTab('terminal')} seeLabel={h.tabs.terminal}>
          <ScriptList scripts={scriptList.slice(0, 5)} runs={scriptRuns} port={livePort} onRun={runScriptHere} onStop={stopScript} />
        </Tile>
        {testRunners.length > 0 && <Tile className="xl:col-span-4" i={3} title={h.tabs.tests} icon={<FlaskConical size={16} />} onSee={() => setTab('tests')}>{testsSummary}</Tile>}
        <Tile className="xl:col-span-4" i={4} title="Docker" icon={<Container size={16} />} aside={composeBadge}>{composeSummary}</Tile>
        <Tile className="xl:col-span-4" i={5} title={h.tabs.database} icon={<Database size={16} />} onSee={() => setTab('database')} seeLabel={h.open}>
          {hub.databases.length === 0 ? <Muted>{h.none}</Muted> : (
            <ul className="flex flex-col">
              {hub.databases.map(d => (
                <li key={d.id} className={ROW}>
                  <button type="button" onClick={() => { setShownDb(d.id); setTab('database') }} className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:text-accent">{d.name}</button>
                  <span className="font-mono text-xs text-fg-muted">{d.type}</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>
        <Tile className="xl:col-span-4" i={6} title={h.tabs.env} icon={<FileKey2 size={16} />} onSee={() => setTab('env')}>
          {hub.envFiles.length === 0 ? <Muted>{t.envFiles.emptyTitle}</Muted> : (
            <ul className="flex flex-col">
              {hub.envFiles.map(f => (
                <li key={f.name} className={ROW}>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{f.name}</span>
                  <span className="text-xs text-fg-muted">{h.envKeys.replace('{n}', String(f.keys))}</span>
                </li>
              ))}
            </ul>
          )}
        </Tile>
        <Tile className="xl:col-span-6" i={7} title={h.tabs.ports} icon={<Globe size={16} />} onSee={() => setTab('ports')}>
          {hub.ports.length === 0 && hub.domains.length === 0 ? <Muted>{h.none}</Muted> : (
            <ul className="flex flex-col">
              {hub.domains.map(d => (
                <li key={d.id} className={ROW}>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">{d.domain} <span className="text-fg-muted">→ localhost:{d.port}</span></span>
                  {listenerOf(d.port) && <Badge color="success">{h.listening.replace('{name}', listenerOf(d.port)!.processName)}</Badge>}
                </li>
              ))}
              {hub.ports.map(x => (
                <li key={x.port} className={ROW}>
                  <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg">localhost:{x.port}</span>
                  {listenerOf(x.port) ? <Badge color="success">{h.listening.replace('{name}', listenerOf(x.port)!.processName)}</Badge> : <span className="text-xs text-fg-muted">{h.notListening}</span>}
                </li>
              ))}
            </ul>
          )}
        </Tile>
        <Tile className="xl:col-span-6" i={8} title={h.tabs.deploy} icon={<CloudUpload size={16} />}
          aside={hub.deployTargets.length ? <Button size="sm" onClick={() => navigate('/deploy')}>{h.deploy}</Button> : undefined}>
          {hub.deployTargets.length === 0 ? <Muted>{h.deployNone}</Muted> : (
            <ul className="flex flex-col">
              {hub.deployTargets.map(d => (
                <li key={d.id} className={ROW}>
                  <Rocket size={14} aria-hidden className="shrink-0 text-fg-muted" />
                  <span className="min-w-0 flex-1 truncate text-sm text-fg">{d.name}</span>
                  <button type="button" onClick={() => setTab('deploy')} className="text-sm font-semibold text-accent hover:text-accent-hover">{h.see}</button>
                </li>
              ))}
            </ul>
          )}
        </Tile>
        <Tile className="xl:col-span-6" i={9} title={h.tabs.logs} icon={<ScrollText size={16} />} onSee={() => setTab('logs')}>
          {hub.logs.length === 0 ? <Muted>{h.none}</Muted> : (
            <ul className="flex flex-col">
              {hub.logs.slice(0, 3).map(l => (
                <li key={l.path} className={ROW}>
                  <button type="button" onClick={() => navigate(`/logs?file=${encodeURIComponent(l.path)}`)} className="min-w-0 flex-1 truncate text-left text-sm text-fg hover:text-accent">{fileName(l.path)}</button>
                  {l.modifiedAt && <span className="font-mono text-xs text-fg-muted">{formatRelative(l.modifiedAt, lang)}</span>}
                </li>
              ))}
            </ul>
          )}
        </Tile>
        <Tile className="xl:col-span-6" i={10} title={h.info} icon={<FolderOpen size={16} />}>
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

    docker: !hub.composeDir ? <EmptyState icon={<Container size={32} />} title={h.composeNone} />
      : !docker ? <CardSkeleton rows={3} /> : !docker.available ? <EmptyState icon={<Container size={32} />} title={h.composeOff} />
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
      ) : <CardSkeleton rows={3} />,

    env: <ProjectEnvEditor projectPath={p.path} onEnvChange={() => {}} />,

    packages: <PackagesPanel projectId={p.id} />,
    notes: <NotesPanel key={p.id} projectId={p.id} projectPath={p.path} />,
    tests: <TestsPanel path={p.path} runners={testRunners} projectName={p.name}
      onOpen={(file, line) => setParams({ tab: 'files', open: file, line: String(line) }, { replace: true })} />,

    database: (
      <div className="flex flex-col gap-4">
        {databaseList}
        {unlinkedDbs.length > 0 && (
          <label className="flex items-center gap-2 self-start">
            <span className="sr-only">{h.dbLink}</span>
            <select value="" onChange={e => e.target.value && link('databases', e.target.value, true)}
              className="h-9 rounded-control border border-line bg-canvas px-3 text-sm text-fg-secondary outline-none">
              <option value="">{h.dbLink}</option>
              {unlinkedDbs.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select>
          </label>
        )}
        <HiddenList items={hub.hidden.databases.map(ref => ({ ref, label: connections.find(c => c.id === ref)?.name ?? ref }))} onShow={ref => link('databases', ref, true)} />
        {/* The database itself, right here: tables, rows, structure, SQL */}
        {dbConn && (
          <div className="h-[640px] overflow-hidden rounded-card border border-line">
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
              className="h-9 w-full rounded-control border border-line bg-canvas px-3 font-mono text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent/60" />
          </label>
          <Button type="submit" variant="secondary" disabled={!newLog.trim()}>{h.tie}</Button>
        </form>
        <HiddenList items={hub.hidden.logs.map(ref => ({ ref, label: fileName(ref) }))} onShow={ref => link('logs', ref, true)} />
      </div>
    ),

    ports: (
      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          <h2 className="px-4.5 pt-4 pb-2 text-md font-semibold text-fg">{h.portsTitle}</h2>
          {hub.ports.length === 0 && <div className="px-4.5 pb-4"><Muted>{h.portsNone}</Muted></div>}
          {hub.ports.map(x => {
            const l = listenerOf(x.port)
            return (
              <div key={x.port} className="group flex items-center gap-3 border-t border-line-subtle px-4.5 py-3">
                <button onClick={() => window.devforge.openExternal(`http://localhost:${x.port}`)} className="inline-flex items-center gap-1 rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs text-fg hover:text-accent">
                  {x.port} <ExternalLink size={10} className="opacity-50" />
                </button>
                <span className="flex-1 font-mono text-xs text-fg-muted">{x.source}</span>
                <span className={cn('font-mono text-xs', l ? 'text-success' : 'text-fg-muted')}>{l ? h.listening.replace('{name}', l.processName) : h.notListening}</span>
                {l && l.pid !== null && l.pid > 4 && (
                  <button onClick={() => freePort(l)} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-2.5 text-xs font-medium text-danger opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-danger hover:text-danger-fg">
                    <XCircle size={12} /> {h.free}
                  </button>
                )}
              </div>
            )
          })}
        </Card>
        <Card className="overflow-hidden">
          <h2 className="px-4.5 pt-4 pb-2 text-md font-semibold text-fg">{h.domainsTitle}</h2>
          {hub.domains.length === 0 && <div className="px-4.5 pb-4"><Muted>{h.domainsNone}</Muted></div>}
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
              className="h-9 rounded-control border border-line bg-canvas px-3 text-sm text-fg-secondary outline-none">
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
        {hub.deployTargets.length === 0 && <div className="p-4.5"><Muted>{h.deployNone}</Muted></div>}
        {hub.deployTargets.map(d => (
          <div key={d.id} className="border-t border-line-subtle first:border-t-0">
            <div className="flex items-center gap-3 px-4.5 py-3">
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

    // v4.1: the project's models, made by hand, from its database or by Forgy
    modeling: <ProjectModels project={p} databases={hub.databases} />,

    github: hub.github ? <GithubPanel projectPath={p.path} repo={hub.github} /> : null,
    symfony: p.framework === 'symfony' ? <SymfonyPanel projectPath={p.path} /> : null,
    nextjs: p.framework === 'nextjs' ? <NextPanel projectPath={p.path} /> : null,
    laravel: p.framework === 'laravel' ? <LaravelPanel projectPath={p.path} /> : null,
    // Drawn below, kept mounted
    terminal: null,

    // The scripts are on the overview: here, the whole width for the tree and the preview
    files: <FilesGitPanel project={p} git={git} busy={busy} rev={gitRev} onGitAction={gitAction}
      onCommitted={() => { loadGit(true); setGitRev(r => r + 1) }}
      open={params.get('open') ? { path: params.get('open')!, line: Number(params.get('line')) || undefined } : undefined} />
  }

  return (
    // The mock-up's measures here: one spacing unit is 4 px (see .df-mockup)
    <div className="df-mockup df-rise mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-9 pt-6.5 pb-24">
      <div className="flex flex-col gap-4">
      {/* Header: where the project is, its state, the actions of every day; the rest behind « ⋯ » */}
      <header className="flex flex-wrap items-end justify-between gap-3.5">
        <div className="flex min-w-0 items-center gap-3.5">
          <IconButton title={h.back} onClick={() => navigate(-1)}><ArrowLeft size={16} /></IconButton>
          <ProjectIcon framework={p.framework} size="lg" />
          <div className="min-w-0">
            <p className="mb-1 flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
              <button type="button" onClick={() => navigate('/projects')} className="hover:text-fg">{t.nav.projects}</button>
              <span aria-hidden>/</span><span className="truncate">{p.name}</span>
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-page font-bold tracking-[-.025em] text-fg">{p.name}</h1>
              <Badge color="accent">{h.active}</Badge>
              {!!git?.changes && <Badge color="warning">{t.home.changed.replace('{n}', String(git.changes)).replace('{s}', git.changes > 1 ? 's' : '')}</Badge>}
            </div>
            <button type="button" onClick={() => window.devforge.openDirectory(p.path)} title={`${h.openFolder} · ${p.path}`}
              className="mt-0.5 block max-w-full truncate text-left font-mono text-xs text-fg-muted hover:text-accent">
              {[p.path, FRAMEWORK_LABEL[p.framework] ?? p.framework, p.packageManager, git?.isRepo ? git.branch : null].filter(Boolean).join(' · ')}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton title={p.favorite ? h.unfavorite : h.favorite} aria-pressed={p.favorite} onClick={toggleFavorite}
            className={cn(p.favorite && 'text-warning hover:text-warning')}><Star size={16} fill={p.favorite ? 'currentColor' : 'none'} /></IconButton>
          {ide.labelFor(p.ide) && <Button variant="secondary" title={h.openIde} aria-label={`${h.openIde} · ${ide.labelFor(p.ide)}`} onClick={() => ide.open(p.path, p.ide)}><Code2 size={14} aria-hidden /> {ide.labelFor(p.ide)}</Button>}
          {scripts.dev && <Button variant="secondary" onClick={() => { runScriptHere('dev'); setTab('terminal') }}><Play size={14} /> {h.runDev}</Button>}
          <AskForgy size="md" label={h.askForgy} icon={<Bot size={14} />} className="border-transparent bg-transparent text-accent hover:bg-elevated hover:text-accent" />
          <MoreMenu label={h.moreActions} items={[
            { label: h.openTerminal, icon: Terminal, onSelect: () => window.devforge.openTerminal(p.path) },
            { label: t.templates.save, icon: LayoutTemplate, onSelect: () => setSavingTemplate(true) },
            { label: h.remove, icon: Trash2, danger: true, onSelect: remove }
          ]} />
        </div>
      </header>

      {savingTemplate && <SaveTemplateDialog project={p} onClose={() => setSavingTemplate(false)} />}

      {/* Tabs, underlined; those that do not fit go in "More" */}
      <TabBar<Tab> active={tab} onSelect={setTab} moreLabel={h.moreTabs}
        items={TABS.filter(x => (x !== 'vercel' || hub.vercel) && (x !== 'github' || hub.github) && (x !== 'packages' || hub.manifests.length > 0) && (x !== 'tests' || testRunners.length > 0) && (x !== 'symfony' && x !== 'nextjs' && x !== 'laravel' || p.framework === x))
          .map(x => ({ id: x, label: h.tabs[x], count: counts[x] }))} />
      </div>

      {tab !== 'terminal' && <div key={tab} className="df-rise">{content[tab]}</div>}
      {termOpened && (
        <div key={p.path} className={cn('grid grid-cols-1 gap-5 lg:grid-cols-12', tab !== 'terminal' && 'hidden')}>
          <TerminalTabs cwd={p.path} withSsh={false} variant="page" className="h-[600px] lg:col-span-8"
            request={scriptRequest} onScripts={setScriptRuns} />
          <ScriptsCard className="lg:col-span-4" scripts={scriptList} runs={scriptRuns} port={livePort} onRun={runScriptHere} onStop={stopScript} />
        </div>
      )}

    </div>
  )
}
