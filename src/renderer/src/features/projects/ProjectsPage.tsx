import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderPlus, FolderSearch, LayoutList, LayoutGrid, Plus, FolderOpen, TriangleAlert } from 'lucide-react'
import type { CiStates, DetectedProject, Framework, SubProject } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import { usePreferredIde } from '@renderer/lib/ide'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import SearchInput from '@renderer/components/ui/SearchInput'
import Spinner from '@renderer/components/ui/Spinner'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import { useNoteCounts } from '@renderer/hooks/useLiveData'
import { ProjectCard, DetectedProjectCard, type CardLayout } from './components/ProjectCard'
import GroupCard from './components/GroupCard'
import { useProjects, sortProjects, frameworkFilters, hideGroupMembers } from './hooks/useProjects'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import { folderName, folderOf, projectFolders } from '@shared/lib/projectFolders'
import { confirmDialog } from '@renderer/app/ConfirmContext'


const VIEW_KEY = 'projects-view'
const NO_COUNTS: Record<string, number> = {}

function readView(): CardLayout {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { t, lang } = useI18n()
  const { runScript } = useConsole()
  const ide = usePreferredIde()
  // The active project's card stands out (its Open button in orange)
  const { active } = useActiveProject()
  /** The boxes left to check in each project's notes */
  const openTasks = useNoteCounts().data ?? NO_COUNTS
  /** v3.8: the GitHub workflows failing now, per project */
  const [ci, setCi] = useState<CiStates>({})
  useEffect(() => {
    window.devforge.github.ciStates().then(setCi).catch(() => {})
    return window.devforge.github.onCiStates(setCi)
  }, [])
  const {
    projects, loaded, gitStatuses, scripts,
    open, openTerminal, toggleFavorite, remove, importDetected
  } = useProjects({ withDetails: true })

  const [detected, setDetected] = useState<DetectedProject[]>([])
  const [scanning, setScanning] = useState(false)
  const [folders,  setFolders]  = useState<string[]>([])
  const [lost,     setLost]     = useState<string[]>([])
  const [filter,   setFilter]   = useState<Framework | 'all'>('all')
  const [place,    setPlace]    = useState<string>('all')
  const [search,   setSearch]   = useState('')
  const [view,     setView]     = useState<CardLayout>(readView)

  function changeView(v: CardLayout) {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ }
  }

  /** Every projects folder; one that no longer exists is reported, not scanned */
  async function runScan(dirs: string[]) {
    if (!dirs.length) return
    setScanning(true)
    try {
      const exists = await Promise.all(dirs.map(d => window.devforge.pathExists(d).catch(() => false)))
      setLost(dirs.filter((_, i) => !exists[i]))
      const found = await Promise.all(dirs.filter((_, i) => exists[i]).map(d => window.devforge.scanDirectory(d).catch(() => [])))
      const byPath = new Map(found.flat().map(d => [d.path, d]))
      setDetected([...byPath.values()])
    } finally { setScanning(false) }
  }

  /** Rescan also offers to remove the projects whose folder is gone */
  async function rescan() {
    await runScan(folders)
    const gone = (await window.devforge.getProjects()).filter(p => p.missing)
    if (!gone.length) return
    const text = t.hub.missingConfirm.replace('{count}', String(gone.length)).replace('{names}', gone.map(p => p.name).join(', '))
    if (!(await confirmDialog(text))) return
    for (const p of gone) await remove(p.id)
  }

  useEffect(() => {
    window.devforge.getSettings().then(s => {
      const dirs = projectFolders(s)
      setFolders(dirs)
      runScan(dirs)
    })
  }, [])

  const savedPaths       = new Set(projects.map(p => p.path))
  const newDetected      = detected.filter(d => !savedPaths.has(d.path))
  // A saved project that lives in a saved group shows inside the group only
  const listed           = hideGroupMembers(projects)
  const frameworksOf     = (p: { framework: Framework; subprojects?: SubProject[] }) => [p.framework, ...(p.subprojects ?? []).map(s => s.framework)]
  const filters          = frameworkFilters([...listed.flatMap(frameworksOf), ...newDetected.flatMap(frameworksOf)])
  // A filter whose last project left: back to all
  const shown            = filter === 'all' || filters.includes(filter) ? filter : 'all'
  // Several folders: each card names its own, and a filter per folder
  const many             = folders.length > 1
  const placeOf          = (path: string) => folderOf(path, folders)
  const shownPlace       = place === 'all' || folders.includes(place) ? place : 'all'

  type Listed = { name: string; framework: Framework; path: string; subprojects?: SubProject[] }
  // In the chosen folder and matching the search: what a stack filter then narrows
  const inView = (p: Listed) =>
    (shownPlace === 'all' || placeOf(p.path) === shownPlace) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  const matches = (p: Listed) => (shown === 'all' || frameworksOf(p).includes(shown)) && inView(p)
  // Each filter says how many projects it would show
  const countOf = (id: Framework | 'all') => [...listed, ...newDetected].filter(p => inView(p) && (id === 'all' || frameworksOf(p).includes(id))).length

  const filteredSaved    = sortProjects(listed).filter(matches)
  const filteredDetected = newDetected.filter(matches)

  const container = view === 'list'
    ? 'flex flex-col gap-2'
    : 'grid grid-flow-row-dense grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5'

  // As in the mock-up: « 5 projets et 1 groupe dans D:\Dev · 4 détectés »
  // French: 0 or 1 projet; English: 1 project only
  const plural = (s: string, n: number) => s.replace('{n}', String(n)).replace('{s}', (lang === 'en' ? n !== 1 : n > 1) ? 's' : '')
  const groups = listed.filter(p => p.framework === 'group').length
  const singles = listed.length - groups
  const where = folders.length > 1 ? plural(t.projects.summaryFolders, folders.length) : folders[0] ?? ''
  const subtitle = plural(t.projects.summaryProjects, singles)
    + (groups ? plural(t.projects.summaryGroups, groups) : '')
    + (where ? t.projects.summaryIn.replace('{where}', where) : '')
    + (newDetected.length ? plural(t.projects.detectedSuffix, newDetected.length) : '')

  return (
    <Page className="df-mockup">
      {/* Title, then the filter box and actions (the mock-up's measures: df-mockup) */}
      <PageHeader crumb={t.nav.groupDev} title={t.projects.title} subtitle={subtitle} actions={<>
        <SearchInput value={search} onChange={setSearch} placeholder={t.projects.searchPlaceholder} className="w-[260px]" />
        {folders.length > 0 && (
          <Button variant="secondary" loading={scanning} onClick={rescan}>
            {!scanning && <FolderSearch size={14} />} {t.projects.rescan}
          </Button>
        )}
        <Tabs<CardLayout>
          value={view}
          onChange={changeView}
          label={t.projects.viewLabel}
          items={[
            { value: 'grid', label: <LayoutGrid size={15} aria-label={t.projects.viewGrid} /> },
            { value: 'list', label: <LayoutList size={15} aria-label={t.projects.viewList} /> }
          ]}
        />
        <Button onClick={() => navigate('/new-project')}><Plus size={15} /> {t.projects.newProject}</Button>
      </>} />

      {/* Stack filters, then folder filters */}
      <div role="group" aria-label={t.projects.stackFilter} className="df-rise flex flex-wrap items-center gap-2.5" style={{ '--i': 1 } as CSSProperties}>
        {filters.length > 1 && (['all', ...filters] as const).map(id => (
          <FilterChip key={id} active={shown === id} onClick={() => setFilter(id)} count={countOf(id)}>
            {id === 'all' ? t.projects.filterAll : id === 'group' ? t.projects.filterGroups : FRAMEWORK_LABEL[id] ?? id}
          </FilterChip>
        ))}
        {/* Projects elsewhere: the folders are kept in Settings */}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => navigate('/settings?section=general')} title={t.projects.addFolderHint}>
          <FolderPlus size={13} aria-hidden /> {t.projects.addFolder}
        </Button>
      </div>
      {many && (
        <div role="group" aria-label={t.projects.folderFilter} className="-mt-2 flex flex-wrap items-center gap-1.5">
          <FolderOpen size={14} className="mr-0.5 text-fg-muted" aria-hidden />
          {['all', ...folders].map(dir => (
            <FilterChip key={dir} active={shownPlace === dir} onClick={() => setPlace(dir)} title={dir === 'all' ? undefined : dir}>
              {dir === 'all' ? t.projects.allFolders : folderName(dir)}
            </FilterChip>
          ))}
        </div>
      )}
      {lost.length > 0 && (
        <p role="status" className="flex items-center gap-2 text-sm text-warning">
          <TriangleAlert size={14} aria-hidden />
          {t.projects.folderMissing.replace('{dirs}', lost.join(', '))}
        </p>
      )}

      {/* Saved */}
      {filteredSaved.length > 0 && (
        <section className="flex flex-col gap-2.5">
          {/* Named only when the detected ones follow, as the mock-up has none */}
          <SectionTitle className={filteredDetected.length ? undefined : 'sr-only'}>{t.projects.yourProjects}</SectionTitle>
          <div className={container}>
            {filteredSaved.map((p, i) => p.framework === 'group' ? (
              <GroupCard
                key={p.id}
                index={i + 2}
                project={p}
                gitStatus={gitStatuses[p.id]}
                ide={ide}
                onTerminal={openTerminal}
                onRunScript={(sub, s) => runScript(sub.path, s, sub.packageManager, `${p.name}/${sub.name}`)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                onDetail={() => navigate(`/project/${p.id}`)}
                onRemove={() => remove(p.id)}
                folder={many ? folderName(placeOf(p.path) ?? '') || null : null}
                openTasks={openTasks[p.id]}
                onOpenTasks={() => navigate(`/project/${p.id}?tab=notes`)}
                ciFailing={ci[p.id]?.failing}
              />
            ) : (
              <ProjectCard
                key={p.id}
                index={i + 2}
                project={p}
                folder={many ? folderName(placeOf(p.path) ?? '') || null : null}
                layout={view}
                gitStatus={gitStatuses[p.id]}
                scripts={scripts[p.id]}
                onOpen={() => open(p)}
                ideLabel={ide.labelFor(p.ide)}
                onOpenVSCode={() => ide.open(p.path, p.ide)}
                onTerminal={() => openTerminal(p.path)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                onDetail={() => navigate(`/project/${p.id}`)}
                onRemove={() => remove(p.id)}
                onRunScript={s => runScript(p.path, s, p.packageManager, p.name)}
                openTasks={openTasks[p.id]}
                onOpenTasks={() => navigate(`/project/${p.id}?tab=notes`)}
                ciFailing={ci[p.id]?.failing}
                active={active?.id === p.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Detected */}
      {filteredDetected.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-baseline gap-3">
            <SectionTitle>{many ? t.projects.detectedInFolders : t.projects.detectedIn.replace('{dir}', folders[0] ?? '')}</SectionTitle>
            <span className="text-xs text-fg-muted">{t.projects.detectedHint}</span>
          </div>
          <div className={container}>
            {filteredDetected.map(p => (
              <DetectedProjectCard
                key={p.path}
                project={p}
                layout={view}
                folder={many ? folderName(placeOf(p.path) ?? '') || null : null}
                onImport={() => importDetected(p)}
                onOpen={() => open(p)}
                onTerminal={() => openTerminal(p.path)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty / scanning */}
      {filteredSaved.length === 0 && filteredDetected.length === 0 && (
        !loaded ? <div className="flex justify-center py-12"><Spinner /></div>
        : scanning
          ? <p className="py-12 text-center text-fg-muted">{t.projects.scanning}</p>
          : <EmptyState
              icon={<FolderOpen size={32} />}
              title={projects.length === 0 && detected.length === 0 ? t.projects.noProjects : t.projects.noMatch}
              action={projects.length === 0 && (
                <Button onClick={() => navigate('/new-project')}><Plus size={14} /> {t.projects.newProject}</Button>
              )}
            />
      )}
    </Page>
  )
}

function FilterChip({ active, onClick, title, count, children }: { active: boolean; onClick: () => void; title?: string; count?: number; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7.5 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        active
          ? 'border-accent/30 bg-accent-soft font-semibold text-accent'
          : 'border-line font-medium text-fg-secondary hover:border-fg-muted hover:text-fg'
      )}
    >
      {children}
      {count !== undefined && <span className={cn('font-mono text-2xs', active ? 'text-accent' : 'text-fg-muted')}>{count}</span>}
    </button>
  )
}
