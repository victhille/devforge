import { useNavigate } from 'react-router-dom'
import { FolderOpen, Monitor, Settings, Plus, Layers, ArrowRight, type LucideIcon } from 'lucide-react'
import type { Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import { FRAMEWORK_COLOR, FRAMEWORK_LABEL } from '@renderer/components/ui/FrameworkIcon'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import { ProjectCard } from '@renderer/features/projects/components/ProjectCard'
import { useProjects, sortProjects } from '@renderer/features/projects/hooks/useProjects'

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ projects }: { projects: Project[] }) {
  const { t } = useI18n()
  const frameworks = Array.from(new Set(projects.map(p => p.framework)))
  const n = projects.length
  const f = frameworks.length
  if (n === 0) return null

  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <div className="flex -space-x-1">
        {frameworks.slice(0, 8).map(fw => (
          <span
            key={fw}
            title={FRAMEWORK_LABEL[fw] ?? fw}
            className="size-3 rounded-full ring-2 ring-surface"
            style={{ background: FRAMEWORK_COLOR[fw] ?? '#6B7280' }}
          />
        ))}
      </div>
      <span className="text-sm text-fg-secondary">
        {t.home.stats
          .replace('{n}', String(n)).replace('{s}', n !== 1 ? 's' : '')
          .replace('{f}', String(f)).replace('{sf}', f !== 1 ? 's' : '')}
      </span>
    </Card>
  )
}

// ─── Onboarding (no projects) ─────────────────────────────────────────────────

function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const steps = [
    { title: t.home.newProject,       text: t.newProject.subtitle },
    { title: t.settings.defaultDir,   text: t.projects.detectedHint }
  ]

  return (
    <Card className="flex flex-col items-center gap-5 px-8 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Layers size={32} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-fg">{t.home.noProjects}</h3>
        <p className="mt-1 text-fg-secondary">{t.home.noRecentHint}</p>
      </div>
      <div className="flex w-full max-w-md flex-col gap-2 text-left">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-line-subtle bg-elevated p-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
              {i + 1}
            </span>
            <div>
              <strong className="text-fg">{step.title}</strong>
              <p className="text-sm text-fg-secondary">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
      <Button size="lg" onClick={() => navigate('/new-project')}>{t.home.createFirst}</Button>
    </Card>
  )
}

// ─── Quick action tile ────────────────────────────────────────────────────────

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-3 rounded-xl border border-line-subtle bg-surface p-4 text-left transition-colors hover:border-accent/40 hover:bg-elevated"
    >
      <Icon size={20} className="text-fg-muted transition-colors group-hover:text-accent" />
      <span className="font-medium text-fg">{label}</span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { projects, loaded, open, openInVSCode, openTerminal, toggleFavorite } = useProjects()

  const recent = sortProjects(projects).slice(0, 5)

  return (
    <Page>
      <PageHeader
        title={t.home.welcome}
        subtitle={t.home.subtitle}
        actions={<Button size="lg" onClick={() => navigate('/new-project')}><Plus size={16} /> {t.home.newProject}</Button>}
      />

      <StatsBar projects={projects} />

      {loaded && projects.length === 0 && <Onboarding />}

      {recent.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <SectionTitle>{t.home.recentProjects}</SectionTitle>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-1 text-sm text-fg-secondary transition-colors hover:text-accent"
            >
              {t.home.allProjects} <ArrowRight size={13} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {recent.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                layout="list"
                onOpen={() => open(p)}
                onOpenVSCode={() => openInVSCode(p)}
                onTerminal={() => openTerminal(p.path)}
                onToggleFavorite={() => toggleFavorite(p.id)}
                onDetail={() => navigate(`/project/${p.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <SectionTitle>{t.home.quickActions}</SectionTitle>
        <div className="grid grid-cols-4 gap-3">
          <QuickAction icon={Plus}       label={t.home.newProject}  onClick={() => navigate('/new-project')} />
          <QuickAction icon={FolderOpen} label={t.home.allProjects} onClick={() => navigate('/projects')} />
          <QuickAction icon={Monitor}    label={t.nav.environment}  onClick={() => navigate('/environment')} />
          <QuickAction icon={Settings}   label={t.nav.settings}     onClick={() => navigate('/settings')} />
        </div>
      </section>
    </Page>
  )
}
