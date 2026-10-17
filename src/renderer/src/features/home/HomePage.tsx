import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Monitor, Settings, Plus, Code2, GitBranch, Layers, Star, Terminal } from 'lucide-react'
import type { Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Badge from '@renderer/components/ui/Badge'
import FrameworkIcon, { FRAMEWORK_COLOR, FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import styles from './HomePage.module.css'

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ projects }: { projects: Project[] }) {
  const { t } = useI18n()
  const frameworks = new Set(projects.map(p => p.framework))
  const n  = projects.length
  const f  = frameworks.size
  const s  = n !== 1 ? 's' : ''
  const sf = f !== 1 ? 's' : ''

  if (n === 0) return null

  return (
    <div className={styles.statsBar}>
      {/* Language breakdown */}
      <div className={styles.statsDots}>
        {Array.from(frameworks).slice(0, 8).map(fw => (
          <span
            key={fw}
            className={styles.statDot}
            style={{ background: FRAMEWORK_COLOR[fw] ?? '#6B7280' }}
            title={FRAMEWORK_LABEL[fw] ?? fw}
          />
        ))}
      </div>
      <span className={styles.statsText}>
        {t.home.stats
          .replace('{n}', String(n)).replace('{s}', s)
          .replace('{f}', String(f)).replace('{sf}', sf)}
      </span>
    </div>
  )
}

// ─── Recent project card ──────────────────────────────────────────────────────

function RecentCard({ project, onOpen, onOpenVSCode, onToggleFavorite, onTerminal, onDetail }: {
  project: Project
  onOpen: () => void
  onOpenVSCode: () => void
  onToggleFavorite: () => void
  onTerminal: () => void
  onDetail: () => void
}) {
  const { t } = useI18n()
  const color = FRAMEWORK_COLOR[project.framework] ?? '#6B7280'
  const label = FRAMEWORK_LABEL[project.framework] ?? project.framework
  return (
    <div className={styles.projectCard}>
      <div className={styles.projectIcon} style={{ background: `${color}18`, borderColor: `${color}30` }}>
        <FrameworkIcon name={project.framework} size={15} style={{ color }} />
      </div>
      <div className={styles.projectInfo} onClick={onDetail} style={{ cursor: 'pointer' }}>
        <span className={styles.projectName}>{project.name}</span>
        <span className={styles.projectPath}>{project.path}</span>
      </div>
      <Badge color="default">{label}</Badge>
      <div className={styles.projectActions}>
        <button
          className={`${styles.iconActionBtn} ${project.favorite ? styles.favActive : ''}`}
          onClick={onToggleFavorite}
          title={t.projects.favorite}
        >
          <Star size={13} fill={project.favorite ? 'currentColor' : 'none'} />
        </button>
        <button className={styles.iconActionBtn} onClick={onTerminal} title={t.projects.terminal}>
          <Terminal size={13} />
        </button>
        <Button variant="secondary" size="sm" onClick={onOpen}>{t.home.open}</Button>
        <Button variant="ghost"     size="sm" onClick={onOpenVSCode}>{t.home.openVSCode}</Button>
      </div>
    </div>
  )
}

// ─── Onboarding (no projects) ─────────────────────────────────────────────────

function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <div className={styles.onboarding}>
      <div className={styles.onboardingIcon}>
        <Layers size={36} style={{ color: 'var(--accent)' }} />
      </div>
      <h3 className={styles.onboardingTitle}>{t.home.noProjects}</h3>
      <p className={styles.onboardingHint}>{t.home.noRecentHint}</p>
      <div className={styles.onboardingSteps}>
        <div className={styles.onboardingStep}>
          <span className={styles.stepNum}>1</span>
          <div>
            <strong>{t.home.newProject}</strong>
            <p>{t.newProject.subtitle}</p>
          </div>
        </div>
        <div className={styles.onboardingStep}>
          <span className={styles.stepNum}>2</span>
          <div>
            <strong>{t.settings.defaultDir}</strong>
            <p>{t.projects.detectedHint}</p>
          </div>
        </div>
      </div>
      <Button onClick={() => navigate('/new-project')} size="lg">{t.home.createFirst}</Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    window.devforge.getProjects().then(setProjects)
  }, [])

  async function handleOpen(project: Project) {
    await window.devforge.updateProjectLastOpened(project.id)
    await window.devforge.openDirectory(project.path)
  }

  async function handleOpenVSCode(project: Project) {
    await window.devforge.openInIDE(project.path, 'vscode')
  }

  async function handleToggleFavorite(project: Project) {
    await window.devforge.toggleFavorite(project.id)
    setProjects(prev => prev.map(p => p.id === project.id ? { ...p, favorite: !p.favorite } : p))
  }

  async function handleTerminal(project: Project) {
    await window.devforge.openTerminal(project.path)
  }

  const recent   = [...projects].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)).slice(0, 5)
  const hasAny   = projects.length > 0

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.home.welcome}</h1>
          <p className={styles.subtitle}>{t.home.subtitle}</p>
        </div>
        <Button onClick={() => navigate('/new-project')} size="lg">
          {t.home.newProject}
        </Button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <StatsBar projects={projects} />

      {/* ── No projects → onboarding ───────────────────────────────────────── */}
      {!hasAny && <Onboarding />}

      {/* ── Recent projects ────────────────────────────────────────────────── */}
      {hasAny && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>{t.home.recentProjects}</h2>
            <button className={styles.seeAll} onClick={() => navigate('/projects')}>
              {t.home.allProjects} →
            </button>
          </div>
          <div className={styles.projectList}>
            {recent.map(p => (
              <RecentCard
                key={p.id}
                project={p}
                onOpen={() => handleOpen(p)}
                onOpenVSCode={() => handleOpenVSCode(p)}
                onToggleFavorite={() => handleToggleFavorite(p)}
                onTerminal={() => handleTerminal(p)}
                onDetail={() => navigate(`/project/${p.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Quick Actions ──────────────────────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.home.quickActions}</h2>
        <div className={styles.quickActions}>
          <button className={styles.actionCard} onClick={() => navigate('/new-project')}>
            <Plus size={20} className={styles.actionIcon} />
            <span>{t.home.newProject}</span>
          </button>
          <button className={styles.actionCard} onClick={() => navigate('/projects')}>
            <FolderOpen size={20} className={styles.actionIcon} />
            <span>{t.home.allProjects}</span>
          </button>
          <button className={styles.actionCard} onClick={() => navigate('/environment')}>
            <Monitor size={20} className={styles.actionIcon} />
            <span>{t.nav.environment}</span>
          </button>
          <button className={styles.actionCard} onClick={() => navigate('/settings')}>
            <Settings size={20} className={styles.actionIcon} />
            <span>{t.nav.settings}</span>
          </button>
        </div>
      </section>
    </div>
  )
}
