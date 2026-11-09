import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ModelSummary, Project } from '@shared/types'
import { mcdSvg } from '@shared/lib/mcd'
import { mpdDiagram } from '@shared/lib/mpd'
import { diagramSvg } from '@shared/lib/schemaLayout'
import { diagramSvg as umlSvg, isDiagramKind } from '@shared/lib/uml'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { formatRelative } from '@renderer/lib/format'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import { Field, Input } from '@renderer/components/ui/Input'
import { diagramColors, mcdColors, schemaColors, svgUrl } from './colors'
import { KIND_TONE, modelUrl } from './model'
import { confirmDialog } from '@renderer/app/ConfirmContext'

/** The dotted ground of a model's thumbnail, as the mock-up's canvas */
const DOTS = { backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1.2px)', backgroundSize: '12px 12px' }

/**
 * A project's models as cards: a thumbnail that opens the model, its kind,
 * name and size, renamed or removed in place. The Modeling page and the
 * project's Modeling tab (v4.1) show the same.
 */
export default function ModelGrid({ project, models, onChanged, from, onNew }: { project: Project; models: ModelSummary[]; onChanged: () => void; from?: string; onNew?: () => void }) {
  const { t, lang } = useI18n()
  const m = t.modeling
  const toast = useToast()
  const navigate = useNavigate()
  const [renaming, setRenaming] = useState<ModelSummary | null>(null)
  const colors = useMemo(() => mcdColors(), [])
  const tableColors = useMemo(() => schemaColors(), [])
  const drawColors = useMemo(() => diagramColors(), [])

  async function remove(model: ModelSummary) {
    if (!(await confirmDialog(m.removeConfirm.replace('{name}', model.name), { danger: true }))) return
    try { await window.devforge.modeling.remove(project.path, model.file); onChanged() }
    catch (err) { toast.show({ tone: 'error', title: m.removeFailed, description: errorText(err) }) }
  }

  return (
    <>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-3.5">
        {models.map(x => (
          <li key={x.file}>
            <Card className="group flex h-full flex-col gap-3 p-4.5">
              <button type="button" onClick={() => navigate(modelUrl(project.path, x.file, undefined, from))} aria-label={m.open.replace('{name}', x.name)}
                style={DOTS} className="block overflow-hidden rounded-control border border-line-subtle bg-canvas">
                {x.mcd && (x.mcd.entities.length || x.mcd.associations.length)
                  ? <img src={svgUrl(mcdSvg(x.mcd, colors, 16))} alt="" className="h-[108px] w-full object-contain" />
                  : x.diagram && isDiagramKind(x.kind) && (x.diagram.nodes.length || x.diagram.notes.length)
                  ? <img src={svgUrl(umlSvg(x.kind, x.diagram, drawColors, 16))} alt="" className="h-[108px] w-full object-contain" />
                  : x.mpd?.tables.length
                  ? <img src={svgUrl((({ diagram, positions }) => diagramSvg(diagram.tables, positions, diagram.links, tableColors))(mpdDiagram(x.mpd)))} alt="" className="h-[108px] w-full object-contain" />
                  : <span className="flex h-[108px] items-center justify-center text-sm text-fg-muted">{m.emptyModel}</span>}
              </button>
              <div className="flex items-center gap-2">
                <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold', KIND_TONE[x.kind])}>{m.kindBadge[x.kind]}</span>
                <span className="min-w-0 flex-1 truncate font-semibold text-fg">{x.name}</span>
                <IconButton size="sm" title={m.rename} onClick={() => setRenaming(x)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Pencil size={13} /></IconButton>
                <IconButton size="sm" tone="danger" title={m.remove} onClick={() => remove(x)} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"><Trash2 size={13} /></IconButton>
              </div>
              <span className="text-sm text-fg-muted" title={`conception/${x.file}`}>
                {x.mcd ? m.mcdCount.replace('{e}', String(x.mcd.entities.length)).replace('{a}', String(x.mcd.associations.length))
                  : x.diagram ? `${m.kindName[x.kind]} · ${m.diagram.count.replace('{n}', String(x.diagram.nodes.length))}`
                  : x.mpd ? m.tableCount.replace('{n}', String(x.mpd.tables.length)).replace('{engine}', m.mpd.engines[x.mpd.engine]) : m.kindName[x.kind]}
                {' · '}{m.modified.replace('{when}', formatRelative(x.updatedAt, lang))}
              </span>
            </Card>
          </li>
        ))}
        {/* As in the mock-up: one more card to start a model */}
        {onNew && (
          <li>
            <button type="button" onClick={onNew}
              className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line p-4.5 text-center transition-colors hover:border-accent/50 hover:bg-hover">
              <Plus size={20} aria-hidden className="text-fg-secondary" />
              <span className="font-semibold text-fg-secondary">{m.newModel}</span>
              <span className="text-xs text-fg-muted">{m.newModelKinds}</span>
            </button>
          </li>
        )}
      </ul>
      {renaming && (
        <NameDialog title={m.renameTitle} initial={renaming.name} submit={m.rename} onClose={() => setRenaming(null)}
          onSubmit={async name => { await window.devforge.modeling.rename(project.path, renaming.file, name); setRenaming(null); onChanged() }} />
      )}
    </>
  )
}

/** A model's name, to create or rename it */
export function NameDialog({ title, initial, submit, onClose, onSubmit }: { title: string; initial: string; submit: string; onClose: () => void; onSubmit: (name: string) => Promise<void> }) {
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
