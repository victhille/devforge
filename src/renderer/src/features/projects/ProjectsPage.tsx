import { useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderSearch, LayoutList, LayoutGrid, Plus, Search, FolderOpen } from 'lucide-react'
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
  const [scanDir,  setScanDir]  = useState('')
  const [filter,   setFilter]   = useState<Framework | 'all'>('all')
  const [search,   setSearch]   = useState('')
  const [view,     setView]     = useState<CardLayout>(readView)

  function changeView(v: CardLayout) {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ }
  }

  async function runScan(dir: string) {
    if (!dir) return
    setScanning(true)
    try { setDetected(await window.devforge.scanDirectory(dir)) }
    finally { setScanning(false) }
  }

  /** Rescan also offers to remove the projects whose folder is gone */
  async function rescan() {
    await runScan(scanDir)
    const gone = (await window.devforge.getProjects()).filter(p => p.missing)
    if (!gone.length) return
    const text = t.hub.missingConfirm.replace('{count}', String(gone.length)).replace('{names}', gone.map(p => p.name).join(', '))
    if (!window.confirm(text)) return
    for (const p of gone) await remove(p.id)
  }

  useEffect(() => {
    window.devforge.getSettings().then(s => {
      if (s.defaultProjectsDir) {
        setScanDir(s.defaultProjectsDir)
        runScan(s.defaultProjectsDir)
      }
    })
  }, [])

  const savedPaths       = new Set(projects.map(p => p.path))
  const newDetected      = detected.filter(d => !savedPaths.has(d.path))
  const filters          = frameworkFilters([...projects.map(p => p.framework), ...newDetected.map(d => d.framework)])
  // A filter whose last project left: back to all
  const shown            = filter === 'all' || filters.includes(filter) ? filter : 'all'

  const matches = (p: { name: string; framework: Framework }) =>
    (shown === 'all' || p.framework === shown) &&
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
        {scanDir && (
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

      {/* Stack filters */}
      <div className="df-rise flex flex-wrap gap-1.5" style={{ '--i': 1 } as CSSProperties}>
        {filters.length > 1 && (['all', ...filters] as const).map(id => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={cn(
              'h-[30px] rounded-full border px-3 text-[12.5px] font-medium transition-colors',
              shown === id
                ? 'border-accent/40 bg-active text-fg'
                : 'border-line bg-surface text-fg-secondary hover:bg-hover hover:text-fg'
            )}
          >
            {id === 'all' ? t.projects.filterAll : FRAMEWORK_LABEL[id] ?? id}
          </button>
        ))}
      </div>

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
            <SectionTitle>{t.projects.detectedIn.replace('{dir}', scanDir)}</SectionTitle>
            <span className="text-xs text-fg-muted">{t.projects.detectedHint}</span>
          </div>
          <div className={container}>
            {filteredDetected.map(p => (
              <DetectedProjectCard
                key={p.path}
                project={p}
                layout={view}
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
