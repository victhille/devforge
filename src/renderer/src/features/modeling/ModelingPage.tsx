import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Pencil, Plus, Shapes, Trash2 } from 'lucide-react'
import type { DbConnection, ModelKind, ModelSummary, Project } from '@shared/types'
import { checkMcd, mcdSvg } from '@shared/lib/mcd'
import { DEFAULT_NAMING, mcdHash, mpdDiagram, toMld } from '@shared/lib/mpd'
import { diagramSvg } from '@shared/lib/schemaLayout'
import { diffMpd, importDb } from '@shared/lib/mpdDb'
import { diagramSvg as umlSvg, isDiagramKind } from '@shared/lib/uml'
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
import { diagramColors, mcdColors, schemaColors, svgUrl } from './colors'
import { fill, KIND_TONE, modelUrl, siblings, useLinkedDb, type ModelTab } from './model'

/** The kinds that can be made today; the others come with the next lots */
const READY: ModelKind[] = ['mcd', 'mpd', 'usecase', 'class', 'sequence', 'flow', 'architecture']
const KINDS: ModelKind[] = ['mcd', 'mpd', 'usecase', 'class', 'sequence', 'flow', 'architecture']

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
  const tableColors = useMemo(() => schemaColors(), [])
  const drawColors = useMemo(() => diagramColors(), [])
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
  const [connections, setConnections] = useState<DbConnection[]>([])
  useEffect(() => { window.devforge.db.list().then(setConnections).catch(() => {}) }, [])
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
          {steps.map(({ step, ready, text, state, onClick }, i) => {
            const body = (
              <>
                <span className={cn('self-start rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] font-semibold', !ready ? 'bg-elevated text-fg-muted' : step === 'mcd' ? KIND_TONE.mcd : KIND_TONE.mpd)}>{m.chainTag[step]}</span>
                <span className="font-semibold text-fg">{m.chainName[step]}</span>
                <span className="truncate text-sm text-fg-secondary">{text}</span>
                {state && <span className={cn('text-sm', state.warn ? 'text-warning' : 'muted' in state ? 'text-fg-muted' : 'text-success')}>{state.text}</span>}
              </>
            )
            return (
              <div key={step} className="flex min-w-0 flex-1 items-center">
                {i > 0 && <ChevronRight size={16} className="shrink-0 text-fg-disabled" aria-hidden />}
                {onClick && project
                  ? <button type="button" onClick={onClick} data-step={step}
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
                      : x.diagram && isDiagramKind(x.kind) && (x.diagram.nodes.length || x.diagram.notes.length)
                      ? <img src={svgUrl(umlSvg(x.kind, x.diagram, drawColors, 16))} alt="" className="h-[96px] w-full object-contain" />
                      : x.mpd?.tables.length
                      ? <img src={svgUrl((({ diagram, positions }) => diagramSvg(diagram.tables, positions, diagram.links, tableColors))(mpdDiagram(x.mpd)))} alt="" className="h-[96px] w-full object-contain" />
                      : <span className="flex h-[96px] items-center justify-center text-sm text-fg-muted">{m.emptyModel}</span>}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={cn('rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] font-semibold', KIND_TONE[x.kind])}>{m.kindTag[x.kind]}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-fg">{x.name}</span>
                    <IconButton size="sm" title={m.rename} onClick={() => setRenaming(x)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Pencil size={13} /></IconButton>
                    <IconButton size="sm" tone="danger" title={m.remove} onClick={() => remove(x)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Trash2 size={13} /></IconButton>
                  </div>
                  <span className="text-sm text-fg-secondary">
                    {x.mcd ? m.mcdCount.replace('{e}', String(x.mcd.entities.length)).replace('{a}', String(x.mcd.associations.length))
                      : x.diagram ? `${m.kindName[x.kind]} · ${m.diagram.count.replace('{n}', String(x.diagram.nodes.length))}`
                      : x.mpd ? m.tableCount.replace('{n}', String(x.mpd.tables.length)).replace('{engine}', m.mpd.engines[x.mpd.engine]) : m.kindName[x.kind]}
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
                  <span className="font-semibold text-fg">{kind === 'mpd' ? m.linked.importTile : m.kindName[kind]}</span>
                  <span className="text-sm text-fg-secondary">{kind === 'mpd' ? m.linked.importTileHint : m.kindHint[kind]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {creating === 'mpd' && project && (
        <ImportDialog project={project} onClose={() => setCreating(null)} onDone={file => navigate(modelUrl(project.path, file, 'mpd'))} />
      )}
      {creating && creating !== 'mpd' && project && (
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

/**
 * v3.9 lot 4: a database read into the project: its MPD, and the MCD worked
 * out from it, both in conception/; the MPD stays linked to the connection.
 */
function ImportDialog({ project, onClose, onDone }: { project: Project; onClose: () => void; onDone: (file: string) => void }) {
  const { t } = useI18n()
  const l = t.modeling.linked
  const [connections, setConnections] = useState<DbConnection[] | null>(null)
  const [conn, setConn] = useState('')
  const [name, setName] = useState(project.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    window.devforge.db.list().then(list => { setConnections(list); if (list[0]) setConn(list[0].id) }).catch(() => setConnections([]))
  }, [])

  async function go() {
    const c = connections?.find(x => x.id === conn)
    if (!c || !name.trim()) return
    setBusy(true)
    try {
      const diagram = await window.devforge.db.diagram(c.id)
      const mcdFile = await window.devforge.modeling.create(project.path, 'mcd', name.trim())
      const { mcd, naming, mpd } = importDb(diagram, c.type, mcdFile)
      await window.devforge.modeling.save(project.path, mcdFile, { v: 1, kind: 'mcd', name: name.trim(), updatedAt: '', mcd, naming })
      const mpdFile = siblings(mcdFile).mpd
      await window.devforge.modeling.save(project.path, mpdFile, { v: 1, kind: 'mpd', name: name.trim(), updatedAt: '', mpd: { ...mpd, connection: c.id } })
      onDone(mpdFile)
    } catch (err) { setError(errorText(err)); setBusy(false) }
  }

  return (
    <Modal title={l.importTitle} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t.common.cancel}</Button><Button onClick={go} disabled={busy || !conn || !name.trim()}>{l.importButton}</Button></>}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-fg-secondary">{l.importHint}</p>
        {!connections ? <Spinner /> : !connections.length ? <p className="text-sm text-fg-muted">{l.importNone}</p> : (
          <Field label={l.importConnection}>
            <select value={conn} onChange={e => setConn(e.target.value)}
              className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-fg outline-none focus:border-accent">
              {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {t.modeling.mpd.engines[c.type]}</option>)}
            </select>
          </Field>
        )}
        <Field label={t.modeling.name} error={error ? `${l.importFailed} : ${error}` : undefined}>
          <Input value={name} onChange={e => { setName(e.target.value); setError('') }} />
        </Field>
      </div>
    </Modal>
  )
}
