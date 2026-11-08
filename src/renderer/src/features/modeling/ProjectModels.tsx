import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Database, ExternalLink, Shapes } from 'lucide-react'
import type { ModelKind, ModelSummary, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import AskForgy from '@renderer/features/assistant/AskForgy'
import { errorText } from '@renderer/lib/errors'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Spinner from '@renderer/components/ui/Spinner'
import { fill, modelUrl, useModels } from './model'
import ModelGrid, { NameDialog } from './ModelGrid'
import { ImportProgress, useModelImport } from './ImportProgress'
import MpdDialog from './MpdDialog'

/** What can be made by hand from here (an MPD too: empty, table by table) */
const KINDS: ModelKind[] = ['mcd', 'mpd', 'usecase', 'class', 'sequence', 'flow', 'architecture']

const NO_MODELS: ModelSummary[] = []

/**
 * v4.1: a project's Modeling tab. Its models, a new one by hand, the MCD and
 * MPD made at once from the project's database (step by step), or Forgy
 * drawing one from what the user describes.
 */
export default function ProjectModels({ project, databases }: { project: Project; databases: { id: string; name: string; type: string }[] }) {
  const { t } = useI18n()
  const m = t.modeling
  const p = m.inProject
  const toast = useToast()
  const navigate = useNavigate()
  const [creating, setCreating] = useState<ModelKind | null>(null)
  const [db, setDb] = useState(databases[0]?.id ?? '')
  const [made, setMade] = useState<{ mcd: string; mpd: string } | null>(null)
  const [brief, setBrief] = useState('')
  const imp = useModelImport()

  // v4.2: kept between pages, read again when one is written or removed (Forgy, an import…)
  const { data: list, error: listError, reload: load } = useModels(project.path)
  const models = list ?? (listError ? NO_MODELS : null)
  useEffect(() => { if (listError) toast.show({ tone: 'error', title: m.loadFailed, description: errorText(listError) }) }, [listError, toast, m.loadFailed])
  useEffect(() => { if (!databases.some(d => d.id === db)) setDb(databases[0]?.id ?? '') }, [databases, db])

  async function fromDatabase() {
    const conn = databases.find(d => d.id === db)
    if (!conn) return
    setMade(null)
    const r = await imp.run(project.path, conn.id, project.name)
    if (r) {
      setMade(r)
      load()
      toast.show({ tone: 'success', title: fill(m.linked.fromDbDone, { name: conn.name, n: r.tables }) })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <Shapes size={16} className="text-fg-muted" />
        <h3 className="mr-auto font-display text-md font-bold tracking-[-.01em] text-fg">{p.title}{models?.length ? <span className="ml-2 font-mono text-xs text-fg-muted">{models.length}</span> : null}</h3>
        <select aria-label={m.newModel} value="" onChange={e => e.target.value && setCreating(e.target.value as ModelKind)}
          className="h-8 rounded-lg border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent">
          <option value="">{m.newModel}…</option>
          {KINDS.map(k => <option key={k} value={k}>{m.kindName[k]}</option>)}
        </select>
        {databases.length > 1 && (
          <select aria-label={m.linked.importConnection} value={db} onChange={e => setDb(e.target.value)}
            className="h-8 max-w-[180px] rounded-lg border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent">
            {databases.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {databases.length > 0 && (
          <Button size="sm" variant="secondary" loading={imp.busy} disabled={imp.busy || !db} onClick={fromDatabase}
            title={fill(m.linked.fromDbHint, { name: databases.find(d => d.id === db)?.name ?? '' })}>
            {!imp.busy && <Database size={13} />} {m.linked.fromDb}
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => navigate('/modeling')}><ExternalLink size={13} /> {p.openPage}</Button>
      </Card>

      {imp.progress && (
        <Card className="flex flex-col gap-3 p-4">
          <ImportProgress progress={imp.progress} details={imp.details} error={imp.error} />
          {made && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => navigate(modelUrl(project.path, made.mcd, undefined, project.id))}>{p.openMcd}</Button>
              <Button size="sm" variant="secondary" onClick={() => navigate(modelUrl(project.path, made.mpd, 'mpd', project.id))}>{p.openMpd}</Button>
              <Button size="sm" variant="ghost" onClick={() => { imp.reset(); setMade(null) }}>{p.close}</Button>
            </div>
          )}
          {imp.error && <Button size="sm" variant="ghost" className="self-start" onClick={imp.reset}>{p.close}</Button>}
        </Card>
      )}

      {!models ? <Spinner className="m-4" /> : models.length
        ? <ModelGrid project={project} models={models} onChanged={load} from={project.id} />
        : <p className="rounded-xl border border-dashed border-line p-5 text-sm text-fg-secondary">{databases.length ? p.emptyWithDb : p.empty}</p>}

      <Card className="flex flex-col gap-2.5 border-forgy/30 p-4">
        <h3 className="flex items-center gap-2 font-display text-md font-bold tracking-[-.01em] text-fg"><Bot size={16} className="text-forgy" /> {p.forgyTitle}</h3>
        <p className="text-sm text-fg-secondary">{p.forgyHint}</p>
        <textarea value={brief} onChange={e => setBrief(e.target.value)} rows={3} placeholder={p.forgyPlaceholder} aria-label={p.forgyTitle}
          className="resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent" />
        <div className="flex flex-wrap gap-2">
          <AskForgy solid label={p.forgyAsk} disabled={!brief.trim()} question={() => { const q = fill(p.forgyPrompt, { project: project.name, text: brief.trim() }); setBrief(''); return q }} />
          {databases.length > 0 && (
            <AskForgy label={p.forgyFromDb} icon={<Database size={13} />} question={() => fill(p.forgyPromptDb, { project: project.name })} />
          )}
        </div>
      </Card>

      {creating === 'mpd' && (
        <MpdDialog project={project} onClose={() => setCreating(null)} onDone={file => navigate(modelUrl(project.path, file, 'mpd', project.id))} />
      )}
      {creating && creating !== 'mpd' && (
        <NameDialog title={m.newTitle.replace('{kind}', m.kindName[creating])} initial={project.name} submit={m.createButton} onClose={() => setCreating(null)}
          onSubmit={async name => {
            const file = await window.devforge.modeling.create(project.path, creating, name)
            navigate(modelUrl(project.path, file, undefined, project.id))
          }} />
      )}
    </div>
  )
}
