import { useState, type CSSProperties, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUp, Layers } from 'lucide-react'
import type { GitRepoDetails, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Card from '@renderer/components/ui/Card'
import { formatRelative } from '@renderer/lib/format'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import { Pill, TileLink } from './parts'
import Mascot from '@renderer/features/assistant/Mascot'
import StatusDot, { type DotState } from '@renderer/components/ui/StatusDot'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'

// ─── State under the greeting ─────────────────────────────────────────────────

export type ChipTone = 'success' | 'warning' | 'accent' | 'danger' | 'muted'
const CHIP_STATE: Record<Exclude<ChipTone, 'accent'>, DotState> = { success: 'on', warning: 'warn', danger: 'error', muted: 'off' }

/** One fact of the moment: a dot of its colour (or an icon), then the words */
export function Chip({ tone, icon, children }: { tone: ChipTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-sm text-fg-secondary">
      {icon ??
        (tone === 'accent' ? (
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent" />
        ) : (
          <StatusDot state={CHIP_STATE[tone]} live={tone === 'success'} />
        ))}
      {children}
    </li>
  )
}

// ─── Pick up again ────────────────────────────────────────────────────────────

/** The three projects opened last, each a click away */
export function ResumeCard({ projects, repos }: { projects: Project[]; repos: { project: Project; details: GitRepoDetails }[] | null }) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const when = (p: Project) => p.lastOpenedAt ?? p.createdAt
  const recent = projects
    .slice()
    .sort((a, b) => when(b).localeCompare(when(a)))
    .slice(0, 3)
  return (
    <Card className="df-rise flex h-full flex-col gap-4 rounded-card p-5.5" style={{ '--i': 1 } as CSSProperties}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold tracking-[-.01em] text-fg">{t.home.resume}</h2>
        <TileLink onClick={() => navigate('/projects')}>
          {t.home.allProjects} <ArrowRight size={14} aria-hidden />
        </TileLink>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
        {recent.map((p, k) => {
          const d = repos?.find(r => r.project.id === p.id)?.details
          return (
            <article key={p.id} className="flex min-w-0 flex-col justify-between gap-3.5 rounded-xl border border-line-subtle bg-canvas p-4.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <ProjectIcon framework={p.framework} size="sm" />
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-fg" title={p.name}>
                    {p.name}
                  </h3>
                  <p className="truncate font-mono text-2xs text-fg-muted" title={p.path}>
                    {p.path}
                  </p>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                {d?.isRepo &&
                  (d.changes > 0 ? (
                    <Pill tone="warning">{t.home.changed.replace('{n}', String(d.changes)).replace('{s}', d.changes > 1 ? 's' : '')}</Pill>
                  ) : d.ahead > 0 ? (
                    <Pill tone="accent">{t.home.ahead.replace('{n}', String(d.ahead))}</Pill>
                  ) : (
                    <Pill tone="success">{t.home.upToDate}</Pill>
                  ))}
                <span className="truncate text-xs text-fg-muted">{formatRelative(when(p), lang)}</span>
              </div>
              <Button
                size="sm"
                variant={k === 0 ? 'primary' : 'secondary'}
                aria-label={t.home.openNamed.replace('{name}', p.name)}
                onClick={() => navigate(`/project/${p.id}`)}
              >
                {t.home.openProject}
              </Button>
            </article>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Forgy ────────────────────────────────────────────────────────────────────

/** Forgy at hand: a question typed here, or one of three asked about the active project */
export function ForgyCard({ project }: { project: Project | null }) {
  const { t } = useI18n()
  const { ask, mood } = useAssistant()
  const [question, setQuestion] = useState('')
  const send = () => {
    const q = question.trim()
    if (!q) return
    ask(q)
    setQuestion('')
  }
  const suggestions = project
    ? [
        { label: t.home.suggestCommit, q: t.home.askCommit },
        { label: t.home.suggestReview, q: t.home.askReview },
        { label: t.home.suggestExplain, q: t.home.askExplain }
      ]
    : []
  return (
    <Card className="df-rise flex h-full flex-col gap-4 rounded-card border-forgy/40 p-5.5" style={{ '--i': 2 } as CSSProperties}>
      <div className="flex items-center gap-3">
        <Mascot mood={mood} size={40} followCursor={false} />
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-[-.01em] text-fg">{t.assistant.mascotName}</h2>
          <p className="text-sm text-fg-muted">
            {t.assistant.moods[mood]} · {t.home.forgyReads}
          </p>
        </div>
      </div>
      <form
        onSubmit={e => {
          e.preventDefault()
          send()
        }}
        className="flex items-center gap-2 rounded-control border border-line-strong bg-canvas py-1.5 pr-1.5 pl-3.5 focus-within:border-accent"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t.home.askForgy}</span>
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder={t.home.askForgyPlaceholder}
            className="h-8 w-full bg-transparent text-base text-fg outline-none placeholder:text-fg-muted"
          />
        </label>
        <IconButton
          type="submit"
          size="sm"
          title={t.home.askSend}
          disabled={!question.trim()}
          className="bg-forgy text-forgy-fg hover:bg-forgy/90 hover:text-forgy-fg disabled:bg-active disabled:text-fg-muted"
        >
          <ArrowUp size={14} />
        </IconButton>
      </form>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => ask(s.q.replace('{project}', project!.name))}
              className="h-9 rounded-full border border-line bg-surface px-3.5 text-sm text-fg-secondary transition-colors hover:border-forgy/50 hover:text-fg"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Onboarding (no projects) ─────────────────────────────────────────────────

export function Onboarding() {
  const { t } = useI18n()
  const navigate = useNavigate()
  return (
    <Card className="df-rise flex flex-col items-center gap-5 px-8 py-10 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Layers size={32} />
      </div>
      <div>
        <h3 className="font-display text-lg font-bold text-fg">{t.home.noProjects}</h3>
        <p className="mt-1 text-fg-secondary">{t.home.noRecentHint}</p>
      </div>
      <Button size="lg" onClick={() => navigate('/new-project')}>
        {t.home.createFirst}
      </Button>
    </Card>
  )
}
