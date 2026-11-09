import { useEffect, useMemo, useState } from 'react'
import { LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus, Shapes, Sparkles } from 'lucide-react'
import type { DbConnection, ModelKind, ModelSummary, Project } from '@shared/types'
import { checkMcd } from '@shared/lib/mcd'
import { DEFAULT_NAMING, mcdHash, toMld } from '@shared/lib/mpd'
import { diffMpd } from '@shared/lib/mpdDb'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Modal from '@renderer/components/ui/Modal'
import { Select } from '@renderer/components/ui/Input'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import AskForgy from '@renderer/features/assistant/AskForgy'
import { fill, KIND_TONE, modelUrl, siblings, useLinkedDb, useModels, type ModelTab } from './model'
import { useDbConnections, useProjectList } from '@renderer/hooks/useLiveData'
import ModelGrid, { NameDialog } from './ModelGrid'
import MpdDialog from './MpdDialog'

/** The kinds that can be made (an MPD: blank, or read from a database, in its dialog) */
const KINDS: ModelKind[] = ['mcd', 'mpd', 'usecase', 'class', 'sequence', 'flow', 'architecture']
const NONE: DbConnection[] = []
const NO_PROJECTS: Project[] = []
const NO_MODELS: ModelSummary[] = []

/**
 * v3.9 lot 2, the mock-up's page: a project's models (files of its conception/
 * folder) as cards, filtered by kind; Forgy or « New model » above them; the
 * chain MCD → MLD → MPD → SQL → database below.
 */
export default function ModelingPage() {
  const { t } = useI18n()
  const m = t.modeling
  const toast = useToast()
  const navigate = useNavigate()
  const { active } = useActiveProject()
  const [chosen, setChosen] = usePersistentState<string | null>('devforge:modeling-project', null)
  const [creating, setCreating] = useState<ModelKind | null>(null)
  const [picking, setPicking] = useState(false)
  const [filter, setFilter] = useState<ModelKind | 'all'>('all')

  // v4.2: kept between pages, read again when they change (Forgy, an import…)
  const projectList = useProjectList()
  const projects = projectList.data ?? (projectList.error ? NO_PROJECTS : null)
  // The project chosen here, else the active one, else the first
  const project = useMemo(() => {
    if (!projects?.length) return null
    return projects.find(p => p.id === chosen) ?? projects.find(p => p.id === active?.id) ?? projects[0]
  }, [projects, chosen, active])

  const { data: list, error: listError, reload: load } = useModels(project?.path)
  const models = list ?? (listError ? NO_MODELS : null)
  useEffect(() => { if (listError) toast.show({ tone: 'error', title: m.loadFailed, description: errorText(listError) }) }, [listError, toast, m.loadFailed])
  // A filter on a kind that has no model any more shows them all
  useEffect(() => { if (filter !== 'all' && models && !models.some(x => x.kind === filter)) setFilter('all') }, [models, filter])

  const mcds = (models ?? []).filter(x => x.kind === 'mcd')
  const mcd = mcds[0]
  const issues = mcd?.mcd ? checkMcd(mcd.mcd).filter(i => i.level === 'error').length : 0
  // The chain follows the latest MCD and its MPD (else the latest MPD alone)
  const mpd = (models ?? []).find(x => x.kind === 'mpd' && (!mcd || x.file === siblings(mcd.file).mpd)) ?? (mcd ? undefined : (models ?? []).find(x => x.kind === 'mpd'))
  const relations = mcd?.mcd ? toMld(mcd.mcd).relations.length : 0
  const mpdStale = !!(mcd?.mcd && mpd?.mpd && mpd.mpd.sourceHash !== mcdHash(mcd.mcd, mcd.naming ?? DEFAULT_NAMING))
  const sqlStale = !!(mpd?.sqlAt && mpd.updatedAt > mpd.sqlAt)
  // The linked database: read when the page opens, to say how far it is from the MPD
  const linked = useLinkedDb(mpd?.mpd?.connection)
  const connections = useDbConnections().data ?? NONE
  const linkedDiffs = mpd?.mpd && linked.diagram ? diffMpd(mpd.mpd, linked.diagram).length : null

  /** Each step of the chain: its state, and where a click leads (null: not yet) */
  const steps = (['mcd', 'mld', 'mpd', 'sql', 'base'] as const).map(step => {
    const go = (file: string, tab: ModelTab) => () => project && navigate(modelUrl(project.path, file, tab))
    switch (step) {
      case 'mcd': return { step, ready: true, text: !mcd ? m.noMcd : m.mcdCount.replace('{e}', String(mcd.mcd?.entities.length ?? 0)).replace('{a}', String(mcd.mcd?.associations.length ?? 0)),
        state: mcd ? (issues ? { warn: true, text: m.toFix.replace('{n}', String(issues)) } : { warn: false, text: m.upToDate }) : null,
        onClick: mcd ? go(mcd.file, 'mcd') : () => setCreating('mcd') }
      case 'mld': return { step, ready: !!mcd, text: mcd ? m.relCount.replace('{n}', String(relations)) : m.noMcd, state: null, onClick: mcd ? go(mcd.file, 'mld') : null }
      case 'mpd': return { step, ready: !!mcd || !!mpd,
        text: mpd?.mpd ? m.tableCount.replace('{n}', String(mpd.mpd.tables.length)).replace('{engine}', m.mpd.engines[mpd.mpd.engine]) : m.noMpd,
        state: mpd ? (mpdStale ? { warn: true, text: m.stale } : { warn: false, text: m.upToDate }) : null,
        onClick: mpd ? go(mpd.file, 'mpd') : mcd ? go(mcd.file, 'mld') : null }
      case 'sql': return { step, ready: !!mpd, text: mpd ? `conception/${siblings(mpd.file).sql}` : m.noSql,
        state: mpd ? (!mpd.sqlAt ? { muted: true, warn: false, text: m.noSql } : sqlStale ? { warn: true, text: m.stale } : { warn: false, text: m.sqlWritten }) : null,
        onClick: mpd ? go(mpd.file, 'sql') : null }
      default: return { step, ready: !!mpd?.mpd?.connection, text: mpd?.mpd?.connection ? (connections.find(c => c.id === mpd.mpd?.connection)?.name ?? m.linked.label) : m.linked.none,
        state: !mpd?.mpd?.connection ? null : linked.error ? { warn: true, text: fill(m.linked.unreachable, { error: '' }).replace(/[ :]+$/, '') }
          : linkedDiffs === null ? { muted: true, warn: false, text: m.linked.loading }
          : linkedDiffs ? { warn: true, text: fill(m.linked.count, { n: linkedDiffs }) } : { warn: false, text: m.upToDate },
        onClick: mpd ? go(mpd.file, 'mpd') : null }
    }
  })

  if (projects && !projects.length) {
    return <Page className="df-mockup"><PageHeader crumb={t.nav.groupData} title={m.title} subtitle={m.subtitle} /><EmptyState icon={<Shapes size={22} />} title={m.noProject} description={m.noProjectHint} /></Page>
  }

  const kindsPresent = KINDS.filter(k => models?.some(x => x.kind === k))
  const shown = (models ?? []).filter(x => filter === 'all' || x.kind === filter)
  const chip = (on: boolean) => cn('flex h-8.5 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors',
    on ? 'border-accent/45 bg-accent-soft text-accent' : 'border-line text-fg-secondary hover:text-fg')

  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupData} title={m.title} subtitle={m.subtitle} />

      {/* As in the mock-up, the two ways to start under the title */}
      <div className="-mt-1 flex flex-wrap gap-2.5">
        <AskForgy size="md" label={m.proposeMcd} icon={<Sparkles size={14} aria-hidden />} disabled={!project}
          question={() => fill(m.proposePrompt, { project: project?.name ?? '' })} />
        <Button onClick={() => setPicking(true)} disabled={!project}><Plus size={14} aria-hidden /> {m.newModel}</Button>
      </div>

      {/* The kinds there are, the project on the right */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={m.filter} className="flex flex-wrap gap-2">
          <button role="radio" aria-checked={filter === 'all'} onClick={() => setFilter('all')} className={chip(filter === 'all')}>
            {m.all}{models?.length ? <span className="font-mono text-xs font-medium opacity-70">{models.length}</span> : null}
          </button>
          {kindsPresent.map(k => (
            <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={chip(filter === k)}>{m.kindBadge[k]}</button>
          ))}
        </div>
        {projects && project && (
          <Select aria-label={m.project} value={project.id} onChange={e => setChosen(e.target.value)} className="ml-auto w-[260px] max-w-full">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        )}
      </div>

      <section aria-label={m.models} className="flex flex-col gap-3">
        {!models ? <LinesSkeleton lines={4} className="m-4" /> : (
          <>
            {!models.length && <p className="text-sm text-fg-secondary">{m.noModels.replace('{name}', project?.name ?? '')}</p>}
            {project && <ModelGrid project={project} models={shown} onChanged={load} onNew={() => setPicking(true)} />}
          </>
        )}
      </section>

      {/* The project's chain: from the MCD to the database */}
      {project && (
        <section aria-label={m.chain} className="flex flex-col gap-2.5">
          <SectionTitle>{m.chain}</SectionTitle>
          <Card className="flex items-stretch overflow-x-auto p-1">
            {steps.map(({ step, ready, text, state, onClick }, i) => {
              const body = (
                <>
                  <span className={cn('self-start rounded-md px-1.5 py-0.5 text-xs font-semibold', !ready ? 'bg-elevated text-fg-muted' : step === 'mcd' ? KIND_TONE.mcd : KIND_TONE.mpd)}>{m.chainTag[step]}</span>
                  <span className="font-semibold text-fg">{m.chainName[step]}</span>
                  <span className="truncate text-sm text-fg-secondary">{text}</span>
                  {state && <span className={cn('text-sm', state.warn ? 'text-warning' : 'muted' in state ? 'text-fg-muted' : 'text-success')}>{state.text}</span>}
                </>
              )
              return (
                <div key={step} className="flex min-w-[150px] flex-1 items-center">
                  {i > 0 && <ChevronRight size={16} className="shrink-0 text-fg-disabled" aria-hidden />}
                  {onClick
                    ? <button type="button" onClick={onClick} data-step={step}
                        className="flex min-w-0 flex-1 flex-col gap-1 rounded-control px-3.5 py-3 text-left transition-colors hover:bg-hover">{body}</button>
                    : <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">{body}</div>}
                </div>
              )
            })}
          </Card>
        </section>
      )}

      {/* Which model: the kinds and what each is for */}
      {picking && project && (
        <Modal title={m.pickTitle} onClose={() => setPicking(false)} className="max-w-2xl">
          <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {KINDS.map(kind => (
              <li key={kind}>
                <button type="button" onClick={() => { setPicking(false); setCreating(kind) }}
                  className="flex h-full w-full flex-col items-start gap-1.5 rounded-xl border border-line bg-surface p-3 text-left transition-colors hover:border-accent/50 hover:bg-hover">
                  <span className={cn('rounded-md px-1.5 py-0.5 text-xs font-semibold', KIND_TONE[kind])}>{m.kindBadge[kind]}</span>
                  <span className="font-semibold text-fg">{m.kindName[kind]}</span>
                  <span className="text-sm text-fg-secondary">{m.kindHint[kind]}</span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {creating === 'mpd' && project && (
        <MpdDialog project={project} onClose={() => setCreating(null)} onDone={file => navigate(modelUrl(project.path, file, 'mpd'))} />
      )}
      {creating && creating !== 'mpd' && project && (
        <NameDialog title={m.newTitle.replace('{kind}', m.kindName[creating])} initial={project.name} submit={m.createButton} onClose={() => setCreating(null)}
          onSubmit={async name => {
            const file = await window.devforge.modeling.create(project.path, creating, name)
            navigate(modelUrl(project.path, file))
          }} />
      )}
    </Page>
  )
}
