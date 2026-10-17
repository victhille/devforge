import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderSearch, Plus, FolderOpen, LayoutList, LayoutGrid, Star, GitBranch, Terminal, Play, Code2 } from 'lucide-react'
import type { Project, DetectedProject, Framework, GitStatus, PackageManager } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useConsole } from '@renderer/app/ConsoleContext'
import Button from '@renderer/components/ui/Button'
import Badge from '@renderer/components/ui/Badge'
import FrameworkIcon, { FRAMEWORK_COLOR, FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import styles from './ProjectsPage.module.css'

type ViewMode = 'list' | 'grid'

// ─── Filters ──────────────────────────────────────────────────────────────────

const FILTERS: { id: Framework | 'all'; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'react',   label: 'React' },
  { id: 'nextjs',  label: 'Next.js' },
  { id: 'vue',     label: 'Vue' },
  { id: 'angular', label: 'Angular' },
  { id: 'nodejs',  label: 'Node.js' },
  { id: 'symfony', label: 'Symfony' },
  { id: 'python',  label: 'Python' },
  { id: 'go',      label: 'Go' },
  { id: 'rust',    label: 'Rust' }
]

// ─── Scripts dropdown ─────────────────────────────────────────────────────────

function ScriptsMenu({ scripts, onRun }: { scripts: Record<string, string>; onRun: (s: string) => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const ref  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const entries = Object.entries(scripts)
  if (entries.length === 0) return null

  return (
    <div className={styles.scriptsMenu} ref={ref}>
      <button
        className={styles.iconActionBtn}
        onClick={() => setOpen(v => !v)}
        title={t.projects.scripts}
      >
        <Play size={12} />
      </button>
      {open && (
        <div className={styles.scriptsDropdown}>
          {entries.map(([name, cmd]) => (
            <button
              key={name}
              className={styles.scriptItem}
              onClick={() => { onRun(name); setOpen(false) }}
            >
              <span className={styles.scriptName}>{name}</span>
              <span className={styles.scriptCmd}>{cmd}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Git badge ────────────────────────────────────────────────────────────────

function GitBadge({ status }: { status: GitStatus | null }) {
  if (!status?.branch) return null
  return (
    <span className={styles.gitBadge}>
      <GitBranch size={9} />
      {status.branch}
      {status.dirty && <span className={styles.dirtyDot} />}
    </span>
  )
}

// ─── Saved list card ──────────────────────────────────────────────────────────

function SavedListCard({ project, onOpen, onOpenVSCode, onRemove, onTerminal, onToggleFavorite, onRunScript, onDetail, gitStatus, scripts }: {
  project:          Project
  onOpen:           () => void
  onOpenVSCode:     () => void
  onRemove:         () => void
  onTerminal:       () => void
  onToggleFavorite: () => void
  onRunScript:      (s: string) => void
  onDetail:         () => void
  gitStatus:        GitStatus | null
  scripts:          Record<string, string>
}) {
  const { t } = useI18n()
  const color = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework
  return (
    <div className={styles.listCard}>
      <button className={`${styles.favBtn} ${project.favorite ? styles.favActive : ''}`} onClick={onToggleFavorite} title="Favorite">
        <Star size={13} fill={project.favorite ? 'currentColor' : 'none'} />
      </button>
      <div className={styles.iconWrap} style={{ background: `${color}18`, borderColor: `${color}30` }}>
        <FrameworkIcon name={project.framework} size={16} style={{ color }} />
      </div>
      <div className={styles.info} onClick={onDetail} style={{ cursor: 'pointer' }}>
        <span className={styles.name}>{project.name}</span>
        <span className={styles.pathRow2}>{project.path} <GitBadge status={gitStatus} /></span>
      </div>
      <Badge color="default">{label}</Badge>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={onOpen}>{t.projects.open}</Button>
        <Button variant="ghost"     size="sm" onClick={onOpenVSCode}>{t.projects.vsCode}</Button>
        <button className={styles.iconActionBtn} onClick={onTerminal} title={t.projects.terminal}><Terminal size={12} /></button>
        <ScriptsMenu scripts={scripts} onRun={onRunScript} />
        <Button variant="ghost" size="sm" onClick={onRemove}>{t.projects.remove}</Button>
      </div>
    </div>
  )
}

// ─── Detected list card ───────────────────────────────────────────────────────

function DetectedListCard({ project, onImport, onOpen, onTerminal }: {
  project:   DetectedProject
  onImport:  () => void
  onOpen:    () => void
  onTerminal:() => void
}) {
  const { t } = useI18n()
  const color = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework
  return (
    <div className={styles.listCard}>
      <div className={styles.iconWrap} style={{ background: `${color}18`, borderColor: `${color}30` }}>
        <FrameworkIcon name={project.framework} size={16} style={{ color }} />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{project.name}</span>
        <span className={styles.pathRow2}>{project.path}</span>
      </div>
      <Badge color="default">{label}</Badge>
      <div className={styles.actions}>
        <button className={styles.iconActionBtn} onClick={onOpen}    title="Open folder"><FolderOpen size={13} /></button>
        <button className={styles.iconActionBtn} onClick={onTerminal} title={t.projects.terminal}><Terminal size={12} /></button>
        <Button variant="secondary" size="sm" onClick={onImport}><Plus size={12} /> {t.projects.import}</Button>
      </div>
    </div>
  )
}

// ─── Saved grid card ──────────────────────────────────────────────────────────

function SavedGridCard({ project, onOpen, onOpenVSCode, onRemove, onTerminal, onToggleFavorite, onRunScript, onDetail, gitStatus, scripts }: {
  project:          Project
  onOpen:           () => void
  onOpenVSCode:     () => void
  onRemove:         () => void
  onTerminal:       () => void
  onToggleFavorite: () => void
  onRunScript:      (s: string) => void
  onDetail:         () => void
  gitStatus:        GitStatus | null
  scripts:          Record<string, string>
}) {
  const { t } = useI18n()
  const color = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework
  return (
    <div className={styles.gridCard} onClick={onDetail} style={{ cursor: 'pointer' }}>
      <div className={styles.gridCardTop}>
        <div className={styles.gridIconWrap} style={{ background: `${color}18`, borderColor: `${color}30` }}>
          <FrameworkIcon name={project.framework} size={24} style={{ color }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge color="default">{label}</Badge>
          <button className={`${styles.favBtn} ${project.favorite ? styles.favActive : ''}`} onClick={onToggleFavorite}>
            <Star size={12} fill={project.favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      <div className={styles.gridCardBody}>
        <span className={styles.gridName}>{project.name}</span>
        <span className={styles.gridPath}>{project.path}</span>
        <GitBadge status={gitStatus} />
      </div>
      <div className={styles.gridCardActions} onClick={e => e.stopPropagation()}>
        <Button variant="secondary" size="sm" onClick={onOpen} style={{ flex: 1 }}>{t.projects.open}</Button>
        <button className={styles.iconActionBtn} onClick={onOpenVSCode} title={t.projects.vsCode}><Code2 size={12} /></button>
        <button className={styles.iconActionBtn} onClick={onTerminal}   title={t.projects.terminal}><Terminal size={12} /></button>
        <ScriptsMenu scripts={scripts} onRun={onRunScript} />
        <button className={styles.iconActionBtn} onClick={onRemove}     title={t.projects.remove}>✕</button>
      </div>
    </div>
  )
}

// ─── Detected grid card ───────────────────────────────────────────────────────

function DetectedGridCard({ project, onImport, onOpen, onTerminal }: {
  project:   DetectedProject
  onImport:  () => void
  onOpen:    () => void
  onTerminal:() => void
}) {
  const { t } = useI18n()
  const color = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework
  return (
    <div className={`${styles.gridCard} ${styles.gridCardDetected}`}>
      <div className={styles.gridCardTop}>
        <div className={styles.gridIconWrap} style={{ background: `${color}18`, borderColor: `${color}30` }}>
          <FrameworkIcon name={project.framework} size={24} style={{ color }} />
        </div>
        <Badge color="default">{label}</Badge>
      </div>
      <div className={styles.gridCardBody}>
        <span className={styles.gridName}>{project.name}</span>
        <span className={styles.gridPath}>{project.path}</span>
      </div>
      <div className={styles.gridCardActions}>
        <Button variant="secondary" size="sm" onClick={onImport} style={{ flex: 1 }}>
          <Plus size={12} /> {t.projects.import}
        </Button>
        <button className={styles.iconActionBtn} onClick={onOpen}     title="Open folder"><FolderOpen size={13} /></button>
        <button className={styles.iconActionBtn} onClick={onTerminal} title={t.projects.terminal}><Terminal size={12} /></button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate    = useNavigate()
  const { t }       = useI18n()
  const console_    = useConsole()

  const [saved,    setSaved]    = useState<Project[]>([])
  const [detected, setDetected] = useState<DetectedProject[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanDir,  setScanDir]  = useState('')
  const [filter,   setFilter]   = useState<Framework | 'all'>('all')
  const [search,   setSearch]   = useState('')
  const [view,     setView]     = useState<ViewMode>(() =>
    (localStorage.getItem('projects-view') as ViewMode) ?? 'list'
  )
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({})
  const [scripts,     setScripts]     = useState<Record<string, Record<string, string>>>({})

  function changeView(v: ViewMode) {
    setView(v); localStorage.setItem('projects-view', v)
  }

  useEffect(() => {
    window.devforge.getProjects().then(projects => {
      setSaved(projects)
      // Fetch git statuses + scripts in parallel
      Promise.all(
        projects.map(p =>
          window.devforge.getGitStatus(p.path)
            .then(s => [p.id, s] as const)
            .catch(() => [p.id, { branch: null, dirty: false, ahead: 0, behind: 0 }] as const)
        )
      ).then(entries => setGitStatuses(Object.fromEntries(entries)))

      Promise.all(
        projects.map(p =>
          window.devforge.getProjectScripts(p.path)
            .then(s => [p.id, s] as const)
            .catch(() => [p.id, {}] as const)
        )
      ).then(entries => setScripts(Object.fromEntries(entries)))
    })

    window.devforge.getSettings().then(s => {
      if (s.defaultProjectsDir) {
        setScanDir(s.defaultProjectsDir)
        runScan(s.defaultProjectsDir)
      }
    })
  }, [])

  async function runScan(dir: string) {
    if (!dir) return
    setScanning(true)
    try { setDetected(await window.devforge.scanDirectory(dir)) }
    finally { setScanning(false) }
  }

  async function handleImport(dp: DetectedProject) {
    const project: Project = {
      id: crypto.randomUUID(),
      name: dp.name, path: dp.path,
      framework: dp.framework, packageManager: dp.packageManager,
      createdAt: new Date().toISOString(), lastOpenedAt: null, favorite: false
    }
    await window.devforge.saveProject(project)
    setSaved(prev => [project, ...prev])
    setDetected(prev => prev.filter(p => p.path !== dp.path))
  }

  async function handleOpen(p: Project | DetectedProject) {
    if ('id' in p) await window.devforge.updateProjectLastOpened(p.id)
    await window.devforge.openDirectory(p.path)
  }

  async function handleOpenVSCode(p: Project) {
    await window.devforge.openInIDE(p.path, 'vscode')
  }

  async function handleRemove(id: string) {
    await window.devforge.removeProject(id)
    setSaved(prev => prev.filter(p => p.id !== id))
  }

  async function handleToggleFavorite(id: string) {
    await window.devforge.toggleFavorite(id)
    setSaved(prev => prev.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p))
  }

  function handleTerminal(path: string) {
    window.devforge.openTerminal(path)
  }

  function handleRunScript(project: Project, script: string) {
    console_.runScript(project.path, script, project.packageManager, project.name)
  }

  const savedPaths  = new Set(saved.map(p => p.path))
  const newDetected = detected.filter(d => !savedPaths.has(d.path))

  // Favorites first, then by name
  const sortedSaved = [...saved].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1
    if (!a.favorite && b.favorite) return 1
    return 0
  })

  const filteredSaved = sortedSaved.filter(p => {
    if (filter !== 'all' && p.framework !== filter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const filteredDetected = newDetected.filter(p => {
    if (filter !== 'all' && p.framework !== filter) return false
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function renderSaved(p: Project) {
    const gs  = gitStatuses[p.id] ?? null
    const sc  = scripts[p.id]    ?? {}
    const props = {
      project:          p,
      onOpen:           () => handleOpen(p),
      onOpenVSCode:     () => handleOpenVSCode(p),
      onRemove:         () => handleRemove(p.id),
      onTerminal:       () => handleTerminal(p.path),
      onToggleFavorite: () => handleToggleFavorite(p.id),
      onRunScript:      (s: string) => handleRunScript(p, s),
      onDetail:         () => navigate(`/project/${p.id}`),
      gitStatus:        gs,
      scripts:          sc
    }
    return view === 'list'
      ? <SavedListCard key={p.id} {...props} />
      : <SavedGridCard key={p.id} {...props} />
  }

  function renderDetected(p: DetectedProject) {
    const props = {
      project:   p,
      onImport:  () => handleImport(p),
      onOpen:    () => handleOpen(p),
      onTerminal:() => handleTerminal(p.path)
    }
    return view === 'list'
      ? <DetectedListCard key={p.path} {...props} />
      : <DetectedGridCard key={p.path} {...props} />
  }

  const containerClass = view === 'list' ? styles.listContainer : styles.gridContainer

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.projects.title}</h1>
          <p className={styles.subtitle}>
            {t.projects.subtitle
              .replace('{n}', String(saved.length))
              .replace('{s}', '')
              .replace('{d}', newDetected.length > 0
                ? t.projects.detectedSuffix.replace('{n}', String(newDetected.length)).replace('{s}', '')
                : ''
              )}
          </p>
        </div>
        <Button onClick={() => navigate('/new-project')}>{t.projects.newProject}</Button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {FILTERS.map(f => (
            <button
              key={f.id}
              className={`${styles.filterBtn} ${filter === f.id ? styles.filterActive : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.id === 'all' ? t.projects.filterAll : f.label}
            </button>
          ))}
        </div>

        <div className={styles.toolbarRight}>
          <input
            className={styles.search}
            placeholder={t.projects.searchPlaceholder}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {scanDir && (
            <Button variant="ghost" size="sm" loading={scanning} onClick={() => runScan(scanDir)}>
              <FolderSearch size={13} /> {t.projects.rescan}
            </Button>
          )}
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => changeView('list')} title="List view">
              <LayoutList size={15} />
            </button>
            <button className={`${styles.viewBtn} ${view === 'grid' ? styles.viewBtnActive : ''}`} onClick={() => changeView('grid')} title="Grid view">
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Saved */}
      {filteredSaved.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.projects.yourProjects}</h2>
          <div className={containerClass}>{filteredSaved.map(renderSaved)}</div>
        </section>
      )}

      {/* Detected */}
      {filteredDetected.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t.projects.detectedIn.replace('{dir}', scanDir)}</h2>
            <span className={styles.sectionHint}>{t.projects.detectedHint}</span>
          </div>
          <div className={containerClass}>{filteredDetected.map(renderDetected)}</div>
        </section>
      )}

      {/* Empty */}
      {filteredSaved.length === 0 && filteredDetected.length === 0 && !scanning && (
        <div className={styles.empty}>
          {saved.length === 0 && detected.length === 0 ? t.projects.noProjects : t.projects.noMatch}
        </div>
      )}
      {scanning && detected.length === 0 && (
        <div className={styles.empty}>{t.projects.scanning}</div>
      )}
    </div>
  )
}
