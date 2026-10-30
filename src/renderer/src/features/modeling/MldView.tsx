import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Copy } from 'lucide-react'
import type { MldNaming, ModelFile } from '@shared/types'
import { checkMcd } from '@shared/lib/mcd'
import { DEFAULT_NAMING, generateMpd, toMld, type MldRelation, type MldRule } from '@shared/lib/mpd'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { errorText } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Spinner from '@renderer/components/ui/Spinner'
import ModelTabs, { modelUrl, siblings, useSiblings } from './ModelTabs'

/** "{a} and {b}" filled in */
export const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all))

/** A relation as text: the primary key between underscores, foreign keys after a # */
const relationText = (r: MldRelation) => `${r.name.toUpperCase()} (${r.columns.map(c => `${c.fk ? '#' : ''}${c.pk ? `_${c.name}_` : c.name}`).join(', ')})`

/**
 * v3.9 lot 3: the MLD, worked out from the MCD at every change: the relations
 * (keys underlined, foreign keys after a #), the rules applied, and the naming
 * the MPD will use. "Make the MPD" writes it next to the MCD.
 */
export default function MldView({ projectPath, file }: { projectPath: string; file: string }) {
  const { t } = useI18n()
  const m = t.modeling
  const l = m.mld
  const toast = useToast()
  const navigate = useNavigate()
  const found = useSiblings(projectPath, file)
  const [model, setModel] = useState<ModelFile | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    window.devforge.modeling.read(projectPath, file).then(setModel).catch(err => setError(errorText(err)))
  }, [projectPath, file])

  const mld = useMemo(() => (model?.mcd ? toMld(model.mcd) : null), [model])
  const errors = useMemo(() => (model?.mcd ? checkMcd(model.mcd).filter(i => i.level === 'error').length : 0), [model])
  const naming = model?.naming ?? DEFAULT_NAMING

  async function setNaming(next: MldNaming) {
    if (!model) return
    const changed = { ...model, naming: next }
    setModel(changed)
    try { await window.devforge.modeling.save(projectPath, file, changed) }
    catch (err) { toast.show({ tone: 'error', title: m.editor.saveFailed, description: errorText(err) }) }
  }

  /** The MPD made (or made again, keeping its hand changes), then opened */
  async function generate() {
    if (!model?.mcd) return
    setBusy(true)
    try {
      const target = siblings(file).mpd
      const prev = found?.mpd?.mpd ?? null
      const engine = prev?.engine ?? await window.devforge.modeling.engine(projectPath)
      const mpd = generateMpd(model.mcd, naming, engine, prev, file)
      await window.devforge.modeling.save(projectPath, target, { v: 1, kind: 'mpd', name: model.name, updatedAt: '', mpd })
      navigate(modelUrl(projectPath, target, 'mpd'), { replace: true })
    } catch (err) {
      setBusy(false)
      toast.show({ tone: 'error', title: l.generateFailed, description: errorText(err) })
    }
  }

  async function copy() {
    if (!mld) return
    await navigator.clipboard.writeText(mld.relations.map(relationText).join('\n') + '\n')
    toast.show({ tone: 'success', title: l.copied })
  }

  if (error) return <div className="p-8"><p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{m.loadFailed} : {error}</p></div>
  if (!model || !mld) return <Spinner className="m-8" />

  const ruleText = (r: MldRule): ReactNode => {
    switch (r.kind) {
      case 'entity': return fill(l.rule.entity, { relation: r.relation, key: r.key.join(', ') })
      case 'noIdentifier': return fill(l.rule.noIdentifier, { relation: r.relation, key: r.key })
      case 'fk': return fill(l.rule.fk, { association: r.association, cards: r.cards, parent: r.parent, child: r.child, columns: r.columns.map(c => `#${c}`).join(', ') })
      case 'oneToOne': return fill(l.rule.oneToOne, { association: r.association, cards: r.cards, parent: r.parent, child: r.child, columns: r.columns.map(c => `#${c}`).join(', ') })
      case 'table': return fill(r.legs > 2 ? l.rule.tableMany : l.rule.table, { association: r.association, n: r.legs, columns: r.columns.map(c => `#${c}`).join(', ') })
      case 'skipped': return fill(l.rule.skipped, { association: r.association })
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-4">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-line bg-surface">
        <header className="flex h-[52px] shrink-0 items-center gap-2 border-b border-line-subtle px-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/modeling')}><ArrowLeft size={13} /> {m.title}</Button>
          <h1 className="min-w-0 truncate text-md font-semibold text-fg">{model.name}</h1>
          <ModelTabs projectPath={projectPath} file={file} tab="mld" hasMcd hasMpd={!!found?.mpd} />
          <span className="hidden truncate text-xs text-fg-muted md:block">{m.fromMcd}</span>
          <span className="flex-1" />
          <Button variant="secondary" size="sm" onClick={copy} disabled={!mld.relations.length}><Copy size={13} /> {l.copy}</Button>
          <Button size="sm" onClick={generate} disabled={busy || !mld.relations.length}>{found?.mpd ? l.update : l.generate} <ArrowRight size={13} /></Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
            {errors > 0 && (
              <button type="button" onClick={() => navigate(modelUrl(projectPath, file, 'mcd'), { replace: true })}
                className="flex items-center gap-2 self-start rounded-lg bg-warning-soft px-3 py-2 text-left text-sm text-fg">
                <AlertTriangle size={14} className="shrink-0 text-warning" /> {m.toFix.replace('{n}', String(errors))} · {m.chainName.mcd}
              </button>
            )}
            {!mld.relations.length ? <p className="text-sm text-fg-secondary">{l.empty}</p> : (
              <section aria-label={fill(l.title, { n: mld.relations.length })} className="flex flex-col gap-3">
                <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{fill(l.title, { n: mld.relations.length })}</h2>
                <ul className="flex flex-col gap-1.5 rounded-xl border border-line-subtle bg-canvas p-4 font-mono text-[13px] leading-relaxed">
                  {mld.relations.map(r => (
                    <li key={r.id} data-relation={r.name}>
                      <span className="font-bold text-fg">{r.name.toUpperCase()}</span>
                      <span className="text-fg-muted"> ( </span>
                      {r.columns.map((c, i) => (
                        <span key={c.key}>
                          {i > 0 && <span className="text-fg-muted">, </span>}
                          <span className={cn(c.pk && 'underline underline-offset-2', c.fk ? 'text-accent' : 'text-fg')}>{c.fk ? '#' : ''}{c.name}</span>
                        </span>
                      ))}
                      <span className="text-fg-muted"> )</span>
                      {r.from === 'association' && <span className="ml-2 font-sans text-xs text-fg-muted">{l.fromAssociation}</span>}
                    </li>
                  ))}
                </ul>
                <p className="flex gap-4 text-xs text-fg-muted">
                  <span><span className="font-mono text-fg underline underline-offset-2">id</span> {l.legendPk}</span>
                  <span><span className="font-mono text-accent">#id</span> {l.legendFk}</span>
                </p>
              </section>
            )}
            {mld.rules.length > 0 && (
              <section aria-label={l.rules} className="flex flex-col gap-3">
                <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{l.rules}</h2>
                <ol className="flex flex-col gap-2">
                  {mld.rules.map((r, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-fg-secondary">
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold',
                        r.kind === 'skipped' || r.kind === 'noIdentifier' ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent')}>{i + 1}</span>
                      <span>{ruleText(r)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <aside aria-label={l.naming} className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-line-subtle p-4">
            <h2 className="font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{l.naming}</h2>
            <NamingSelect label={l.namingTables} value={naming.tables} options={l.tablesOpt} onChange={v => setNaming({ ...naming, tables: v })} />
            <NamingSelect label={l.namingPk} value={naming.pk} options={l.pkOpt} onChange={v => setNaming({ ...naming, pk: v })} />
            <NamingSelect label={l.namingFk} value={naming.fk} options={l.fkOpt} onChange={v => setNaming({ ...naming, fk: v })} />
            <NamingSelect label={l.namingJoin} value={naming.join} options={l.joinOpt} onChange={v => setNaming({ ...naming, join: v })} />
            <p className="mt-auto text-xs leading-snug text-fg-muted">{l.hint}</p>
          </aside>
        </div>
      </div>
    </div>
  )
}

function NamingSelect<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-fg-secondary">
      {label}
      <select value={value} onChange={e => onChange(e.target.value as T)}
        className="h-8 rounded-md border border-line bg-canvas px-2 font-mono text-sm text-fg outline-none focus:border-accent">
        {(Object.keys(options) as T[]).map(k => <option key={k} value={k}>{options[k]}</option>)}
      </select>
    </label>
  )
}
