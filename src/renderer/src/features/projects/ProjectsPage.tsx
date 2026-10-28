import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderSearch, LayoutList, LayoutGrid, Plus, Search, FolderOpen, TriangleAlert } from 'lucide-react'
import type { DetectedProject, Framework } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import { usePreferredIde } from '@renderer/lib/ide'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, SectionTitle } from '@renderer/components/ui/Page'
import { ProjectCard, DetectedProjectCard, type CardLayout } from './components/ProjectCard'
import { useProjects, sortProjects, frameworkFilters } from './hooks/useProjects'
import { FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import { folderName, folderOf, projectFolders } from '@shared/lib/projectFolders'


const VIEW_KEY = 'projects-view'

function readView(): CardLayout {
  try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid' } catch { return 'grid' }
}

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { runScript } = useConsole()
  const ide = usePreferredIde()
  const {
    projects, gitStatuses, scripts,
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
    if (!window.confirm(text)) return
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
  const filters          = frameworkFilters([...projects.map(p => p.framework), ...newDetected.map(d => d.framework)])
  // A filter whose last project left: back to all
  const shown            = filter === 'all' || filters.includes(filter) ? filter : 'all'
  // Several folders: each card names its own, and a filter per folder
  const many             = folders.length > 1
  const placeOf          = (path: string) => folderOf(path, folders)
  const shownPlace       = place === 'all' || folders.includes(place) ? place : 'all'

  const matches = (p: { name: string; framework: Framework; path: string }) =>
    (shown === 'all' || p.framework === shown) &&
    (shownPlace === 'all' || placeOf(p.path) === shownPlace) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))

  const filteredSaved    = sortProjects(projects).filter(matches)
  const filteredDetected = newDetected.filter(matches)

  const container = view === 'list'
    ? 'flex flex-col gap-2'
    : 'grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4'

  const subtitle = t.projects.subtitle
    .replace('{n}', String(projects.length))
    .replace('{s}', '')
    .replace('{d}', newDetected.length > 0
      ? t.projects.detectedSuffix.replace('{n}', String(newDetected.length)).replace('{s}', '')
      : '')

  return (
    <Page className="max-w-[1280px] gap-5 px-8 pt-7">
      {/* Title, filter box and actions on one row */}
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-.02em] text-fg">{t.projects.title}</h1>
          <p className="text-sm text-fg-muted">{subtitle}</p>
        </div>
        <label className="flex h-9 w-[260px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-3 text-fg-muted focus-within:border-accent/60">
          <Search size={14} />
          <span className="sr-only">{t.projects.searchPlaceholder}</span>
          <input
            placeholder={t.projects.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
          />
        </label>
        {folders.length > 0 && (
          <Button variant="secondary" loading={scanning} onClick={rescan}>
            {!scanning && <FolderSearch size={14} />} {t.projects.rescan}
          </Button>
        )}
        <Tabs<CardLayout>
          value={view}
          onChange={changeView}
          items={[
            { value: 'grid', label: <LayoutGrid size={15} aria-label="Grid view" /> },
            { value: 'list', label: <LayoutList size={15} aria-label="List view" /> }
          ]}
        />
        <Button onClick={() => navigate('/new-project')}><Plus size={15} /> {t.projects.newProject}</Button>
      </header>

      {/* Stack filters, then folder filters */}
      <div className="df-rise flex flex-wrap gap-1.5" style={{ '--i': 1 } as CSSProperties}>
        {filters.length > 1 && (['all', ...filters] as const).map(id => (
          <FilterChip key={id} active={shown === id} onClick={() => setFilter(id)}>
            {id === 'all' ? t.projects.filterAll : FRAMEWORK_LABEL[id] ?? id}
          </FilterChip>
        ))}
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
        <p role="status" className="flex items-center gap-2 text-[12.5px] text-warning">
          <TriangleAlert size={14} aria-hidden />
          {t.projects.folderMissing.replace('{dirs}', lost.join(', '))}
        </p>
      )}

      {/* Saved */}
      {filteredSaved.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <SectionTitle>{t.projects.yourProjects}</SectionTitle>
          <div className={container}>
            {filteredSaved.map((p, i) => (
              <ProjectCard
                key={p.id}
                index={i + 2}
                project={p}
                folder={many ? folderName(placeOf(p.path) ?? '') || null : null}
                layout={view}
                gitStatus={gitStatuses[p.id]}
                scripts={scripts[p.id]}
                onOpen={() => open(p)}
                ideLabel={ide.label}
                onOpenVSCode={() => ide.open(p.path)}
                onTerminal={() => openTerminal(p.path)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                onDetail={() => navigate(`/project/${p.id}`)}
                onRemove={() => remove(p.id)}
                onRunScript={s => runScript(p.path, s, p.packageManager, p.name)}
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
        scanning
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

function FilterChip({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'h-[30px] rounded-full border px-3 text-[12.5px] font-medium transition-colors',
        active
          ? 'border-accent/40 bg-active text-fg'
          : 'border-line bg-surface text-fg-secondary hover:bg-hover hover:text-fg'
      )}
    >
      {children}
    </button>
  )
}
