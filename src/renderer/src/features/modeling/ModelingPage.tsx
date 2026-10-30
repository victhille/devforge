import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Pencil, Plus, Shapes, Trash2 } from 'lucide-react'
import type { ModelKind, ModelSummary, Project } from '@shared/types'
import { checkMcd, mcdSvg } from '@shared/lib/mcd'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { useActiveProject } from '@renderer/hooks/useActiveProject'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { formatRelative } from '@renderer/lib/format'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Field, Input } from '@renderer/components/ui/Input'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import { mcdColors, svgUrl } from './colors'

/** The colour of each kind's tag, the same everywhere */
export const KIND_TONE: Record<ModelKind, string> = {
  mcd: 'bg-[color-mix(in_srgb,var(--syntax-keyword)_16%,transparent)] text-[var(--syntax-keyword)]',
  mpd: 'bg-accent-soft text-accent',
  usecase: 'bg-success/15 text-success',
  class: 'bg-[color-mix(in_srgb,var(--syntax-number)_16%,transparent)] text-[var(--syntax-number)]',
  sequence: 'bg-[color-mix(in_srgb,var(--syntax-tag)_16%,transparent)] text-[var(--syntax-tag)]',
  flow: 'bg-[color-mix(in_srgb,var(--syntax-attr)_16%,transparent)] text-[var(--syntax-attr)]',
  architecture: 'bg-elevated text-fg-secondary'
}

/** The kinds that can be made today; the others come with the next lots */
const READY: ModelKind[] = ['mcd']
const KINDS: ModelKind[] = ['mcd', 'mpd', 'usecase', 'class', 'sequence', 'flow', 'architecture']

export const modelUrl = (projectPath: string, file: string) => `/model?project=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(file)}`

/**
 * v3.9 lot 2: the Modeling page. A project's models (files of its conception/
 * folder), the chain MCD → MLD → MPD → SQL → database, and the kinds to create.
 */
export default function ModelingPage() {
  const { t, lang } = useI18n()
  const m = t.modeling
  const toast = useToast()
  const navigate = useNavigate()
  const { active } = useActiveProject()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [chosen, setChosen] = usePersistentState<string | null>('devforge:modeling-project', null)
  const [models, setModels] = useState<ModelSummary[] | null>(null)
  const [creating, setCreating] = useState<ModelKind | null>(null)
  const [renaming, setRenaming] = useState<ModelSummary | null>(null)

  useEffect(() => { window.devforge.getProjects().then(setProjects).catch(() => setProjects([])) }, [])
  // The project chosen here, else the active one, else the first
  const project = useMemo(() => {
    if (!projects?.length) return null
    return projects.find(p => p.id === chosen) ?? projects.find(p => p.id === active?.id) ?? projects[0]
  }, [projects, chosen, active])

  const load = useCallback(() => {
    if (!project) return
    setModels(null)
    window.devforge.modeling.list(project.path).then(setModels).catch(err => { setModels([]); toast.show({ tone: 'error', title: m.loadFailed, description: errorText(err) }) })
  }, [project, toast, m.loadFailed])
  useEffect(() => { load() }, [load])

  const colors = useMemo(() => mcdColors(), [])
  const mcds = (models ?? []).filter(x => x.kind === 'mcd')
  const mcd = mcds[0]
  const issues = mcd?.mcd ? checkMcd(mcd.mcd).filter(i => i.level === 'error').length : 0

  async function remove(model: ModelSummary) {
    if (!project || !window.confirm(m.removeConfirm.replace('{name}', model.name))) return
    try { await window.devforge.modeling.remove(project.path, model.file); load() }
    catch (err) { toast.show({ tone: 'error', title: m.removeFailed, description: errorText(err) }) }
  }

  if (projects && !projects.length) {
    return <Page><PageHeader title={m.title} subtitle={m.subtitle} /><EmptyState icon={<Shapes size={22} />} title={m.noProject} description={m.noProjectHint} /></Page>
  }

  return (
    <Page className="gap-6">
      <PageHeader
        title={m.title}
        subtitle={m.subtitle}
        actions={<>
          {projects && project && (
            <select aria-label={m.project} value={project.id} onChange={e => setChosen(e.target.value)}
              className="h-9 max-w-[240px] rounded-lg border border-line bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent">
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <Button onClick={() => setCreating('mcd')} disabled={!project}><Plus size={14} /> {m.newModel}</Button>
        </>}
      />

      {/* The project's chain: the MCD now, the next steps with the next lots */}
      <section aria-label={m.chain} className="flex flex-col gap-2.5">
        <SectionTitle>{m.chain}</SectionTitle>
        <Card className="flex items-stretch p-1">
          {(['mcd', 'mld', 'mpd', 'sql', 'base'] as const).map((step, i) => {
            const ready = step === 'mcd'
            const body = (
              <>
                <span className={cn('self-start rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] font-semibold', ready ? KIND_TONE.mcd : 'bg-elevated text-fg-muted')}>{m.chainTag[step]}</span>
                <span className="font-semibold text-fg">{m.chainName[step]}</span>
                <span className="truncate text-sm text-fg-secondary">
                  {!ready ? m.soon : !mcd ? m.noMcd : m.mcdCount.replace('{e}', String(mcd.mcd?.entities.length ?? 0)).replace('{a}', String(mcd.mcd?.associations.length ?? 0))}
                </span>
                {ready && mcd && <span className={cn('text-sm', issues ? 'text-warning' : 'text-success')}>{issues ? m.toFix.replace('{n}', String(issues)) : m.upToDate}</span>}
              </>
            )
            return (
              <div key={step} className="flex min-w-0 flex-1 items-center">
                {i > 0 && <ChevronRight size={16} className="shrink-0 text-fg-disabled" aria-hidden />}
                {ready && project
                  ? <button type="button" onClick={() => mcd ? navigate(modelUrl(project.path, mcd.file)) : setCreating('mcd')}
                      className="flex min-w-0 flex-1 flex-col gap-1 rounded-lg px-3.5 py-3 text-left transition-colors hover:bg-hover">{body}</button>
                  : <div className="flex min-w-0 flex-1 flex-col gap-1 px-3.5 py-3">{body}</div>}
              </div>
            )
          })}
        </Card>
      </section>

      <section aria-label={m.models} className="flex flex-col gap-2.5">
        <SectionTitle>{m.models}</SectionTitle>
        {!models ? <Spinner className="m-4" /> : !models.length ? (
          <p className="rounded-xl border border-dashed border-line p-5 text-sm text-fg-secondary">{m.noModels.replace('{name}', project?.name ?? '')}</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
            {models.map(x => (
              <li key={x.file}>
                <Card className="group flex flex-col gap-2 p-3">
                  <button type="button" onClick={() => project && navigate(modelUrl(project.path, x.file))} aria-label={m.open.replace('{name}', x.name)}
                    className="block overflow-hidden rounded-lg border border-line-subtle bg-canvas">
                    {x.mcd && (x.mcd.entities.length || x.mcd.associations.length)
                      ? <img src={svgUrl(mcdSvg(x.mcd, colors, 16))} alt="" className="h-[96px] w-full object-contain" />
                      : <span className="flex h-[96px] items-center justify-center text-sm text-fg-muted">{m.emptyModel}</span>}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] font-semibold', KIND_TONE[x.kind])}>{m.kindTag[x.kind]}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">{x.name}</span>
                    <IconButton size="sm" title={m.rename} onClick={() => setRenaming(x)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Pencil size={13} /></IconButton>
                    <IconButton size="sm" tone="danger" title={m.remove} onClick={() => remove(x)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Trash2 size={13} /></IconButton>
                  </div>
                  <span className="text-sm text-fg-secondary">
                    {x.mcd ? m.mcdCount.replace('{e}', String(x.mcd.entities.length)).replace('{a}', String(x.mcd.associations.length)) : m.kindName[x.kind]}
                    {' · '}{formatRelative(x.updatedAt, lang)}
                  </span>
                  <span className="truncate font-mono text-xs text-fg-muted">conception/{x.file}</span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={m.create} className="flex flex-col gap-2.5">
        <SectionTitle>{m.create}</SectionTitle>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {KINDS.map(kind => {
            const ready = READY.includes(kind)
            return (
              <li key={kind}>
                <button type="button" disabled={!ready || !project} onClick={() => setCreating(kind)}
                  className={cn('flex h-full w-full flex-col items-start gap-1.5 rounded-xl border border-dashed p-3 text-left transition-colors',
                    ready ? 'border-line bg-surface hover:border-accent/50 hover:bg-hover' : 'border-line-subtle opacity-60')}>
                  <span className="flex w-full items-center gap-2">
                    <span className={cn('rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] font-semibold', KIND_TONE[kind])}>{m.kindTag[kind]}</span>
                    {!ready && <span className="ml-auto text-xs text-fg-muted">{m.soon}</span>}
                  </span>
                  <span className="font-semibold text-fg">{m.kindName[kind]}</span>
                  <span className="text-sm text-fg-secondary">{m.kindHint[kind]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {creating && project && (
        <NameDialog title={m.newTitle.replace('{kind}', m.kindName[creating])} initial={project.name} submit={m.createButton} onClose={() => setCreating(null)}
          onSubmit={async name => {
            const file = await window.devforge.modeling.create(project.path, creating, name)
            navigate(modelUrl(project.path, file))
          }} />
      )}
      {renaming && project && (
        <NameDialog title={m.renameTitle} initial={renaming.name} submit={m.rename} onClose={() => setRenaming(null)}
          onSubmit={async name => { await window.devforge.modeling.rename(project.path, renaming.file, name); setRenaming(null); load() }} />
      )}
    </Page>
  )
}

/** A model's name, to create or rename it */
function NameDialog({ title, initial, submit, onClose, onSubmit }: { title: string; initial: string; submit: string; onClose: () => void; onSubmit: (name: string) => Promise<void> }) {
  const { t } = useI18n()
  const [name, setName] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function go() {
    if (!name.trim()) return
    setBusy(true)
    try { await onSubmit(name.trim()) } catch (err) { setError(errorText(err)); setBusy(false) }
  }
  return (
    <Modal title={title} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button onClick={go} disabled={busy || !name.trim()}>{submit}</Button></>}>
      <Field label={t.modeling.name} error={error || undefined}>
        <Input value={name} autoFocus onChange={e => { setName(e.target.value); setError('') }} onKeyDown={e => { if (e.key === 'Enter') go() }} />
      </Field>
    </Modal>
  )
}
