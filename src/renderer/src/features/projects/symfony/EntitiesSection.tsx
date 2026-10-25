import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { SfEntity, SfEntityDraft, SfWriteResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Tabs from '@renderer/components/ui/Tabs'
import EmptyState from '@renderer/components/ui/EmptyState'
import EntityForm, { relationSentence, type EntityKit } from './EntityForm'
import { Section } from './parts'

interface Props {
  kit: EntityKit
  entities: SfEntity[]
  /** A draft prepared by Forgy, opened in the form */
  draft: SfEntityDraft | null
  onDraftUsed: () => void
  onWritten: (result: SfWriteResult) => void
}

/** Entities as cards; a relation's target lights up on hover */
export default function EntitiesSection({ kit, entities, draft, onDraftUsed, onWritten }: Props) {
  const { t } = useI18n()
  const s = t.symfony
  const [view, setView] = useState<'schema' | 'list'>('schema')
  const [editing, setEditing] = useState<SfEntity | 'new' | null>(draft ? (entities.find(e => e.name === draft.name) ?? 'new') : null)
  const [hover, setHover] = useState<string | null>(null)

  if (editing) {
    return (
      <EntityForm
        kit={kit}
        entities={entities}
        existing={editing === 'new' ? null : editing}
        initial={draft}
        onCancel={() => { setEditing(null); onDraftUsed() }}
        onDone={r => { setEditing(null); onDraftUsed(); onWritten(r) }}
      />
    )
  }

  return (
    <Section
      title={s.entitiesTitle.replace('{n}', String(entities.length))}
      help={kit.listHelp}
      actions={<>
        <Tabs<'schema' | 'list'> value={view} onChange={setView} items={[{ value: 'schema', label: s.schema }, { value: 'list', label: s.list }]} />
        <Button size="sm" onClick={() => setEditing('new')}><Plus size={13} /> {s.newEntity}</Button>
      </>}
    >
      {entities.length === 0 ? (
        <EmptyState title={s.noEntities} description={s.noEntitiesHelp} />
      ) : view === 'schema' ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3 rounded-xl bg-canvas p-3">
          {entities.map(e => (
            <article
              key={e.name}
              aria-label={e.name}
              className={cn('flex flex-col rounded-xl border bg-surface transition-colors',
                hover === e.name ? 'border-accent shadow-[0_0_0_2px] shadow-accent/25' : 'border-line-subtle')}
            >
              <header className="flex items-center gap-2 border-b border-line-subtle px-3 py-2">
                <strong className="flex-1 truncate text-fg">{e.name}</strong>
                {e.apiResource && <span className="rounded-full bg-accent-soft px-2 font-mono text-[10.5px] text-accent">API</span>}
                <button onClick={() => setEditing(e)} className="text-xs font-medium text-accent hover:underline">{s.addTo}</button>
              </header>
              <ul className="flex flex-col gap-0.5 px-3 py-2 font-mono text-xs text-fg-secondary">
                {e.fields.map(f => (
                  <li key={f.name} className="flex gap-2">
                    <span className="truncate">{f.name}</span>
                    <span className="ml-auto shrink-0 text-fg-muted">{s.types[f.type]}{f.nullable ? '' : ' *'}{f.unique ? ' · ' + s.uniqueShort : ''}</span>
                  </li>
                ))}
                {e.relations.map(r => (
                  <li key={r.name} onMouseEnter={() => setHover(r.target)} onMouseLeave={() => setHover(null)}
                    title={relationSentence(s, e.name, r)} className="flex gap-2 text-accent">
                    <span className="truncate">{r.name}</span>
                    <span className="ml-auto shrink-0">{r.kind === 'OneToMany' || r.kind === 'ManyToMany' ? '⇉' : '→'} {r.target}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-xl border border-line-subtle">
          {entities.map(e => (
            <div key={e.name} className="flex flex-col gap-1 border-t border-line-subtle px-4 py-3 first:border-t-0">
              <div className="flex items-center gap-2">
                <strong className="text-fg">{e.name}</strong>
                <code className="font-mono text-xs text-fg-muted">{e.file}</code>
                <span className="ml-auto text-xs text-fg-muted">{s.fieldCount.replace('{n}', String(e.fields.length))}</span>
                <button onClick={() => setEditing(e)} className="text-xs font-medium text-accent hover:underline">{s.addTo}</button>
              </div>
              {e.relations.map(r => <span key={r.name} className="text-sm text-fg-secondary">{relationSentence(s, e.name, r)}</span>)}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-fg-muted">{s.schemaLegend}</p>
    </Section>
  )
}
