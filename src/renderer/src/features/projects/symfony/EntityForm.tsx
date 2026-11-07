import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { SfEntity, SfEntityDraft, SfField, SfFieldType, SfRelation, SfRelationKind, SfWriteResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import IconButton from '@renderer/components/ui/IconButton'
import { Input, Select } from '@renderer/components/ui/Input'
import { Section } from './parts'
import { errorText } from '@renderer/lib/errors'

const TYPES: SfFieldType[] = ['string', 'text', 'integer', 'float', 'decimal', 'boolean', 'date', 'datetime', 'json']
const KINDS: SfRelationKind[] = ['ManyToOne', 'OneToMany', 'ManyToMany', 'OneToOne']

const lcfirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const plural = (w: string) => /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : /(s|x|z)$/.test(w) ? w : w + 's'

/** Name of the property on the other side: Facture.client ↔ User.factures */
export function suggestInverse(owner: string, kind: SfRelationKind): string {
  return kind === 'ManyToOne' || kind === 'ManyToMany' ? plural(lcfirst(owner)) : lcfirst(owner)
}

/** Name of this side's property from the target: "categorie", "produits" */
const suggestName = (target: string, kind: SfRelationKind) => kind === 'OneToMany' || kind === 'ManyToMany' ? plural(lcfirst(target)) : lcfirst(target)

const newField = (): SfField => ({ name: '', type: 'string', nullable: false, unique: false })

/** What differs from one stack to another: how an entity is written, which files it touches */
export interface EntityKit {
  write: (draft: SfEntityDraft) => Promise<SfWriteResult>
  /** Files touched, shown before saving ("+ new", "~ changed") */
  files: (owner: string, existing: SfEntity | null, linked: string[]) => string[]
  /** Above the form, and above the list */
  help: string
  listHelp: string
}

/** Symfony: one PHP class and its repository per entity, both sides of each link */
export const symfonyKit = (projectPath: string, entities: SfEntity[], s: { entityHelp: string; entitiesHelp: string }): EntityKit => ({
  write: draft => window.devforge.symfony.writeEntity(projectPath, draft),
  files: (owner, existing, linked) => [
    ...(existing ? [`~ ${existing.file}`] : owner ? [`+ src/Entity/${owner}.php`, `+ src/Repository/${owner}Repository.php`] : []),
    ...linked.map(tg => `~ ${entities.find(e => e.name === tg)?.file ?? `src/Entity/${tg}.php`}`)
  ],
  help: s.entityHelp,
  listHelp: s.entitiesHelp
})

interface Props {
  kit: EntityKit
  entities: SfEntity[]
  /** Fields and relations added to this entity; null for a new one */
  existing: SfEntity | null
  initial?: SfEntityDraft | null
  onDone: (result: SfWriteResult) => void
  onCancel: () => void
}

export default function EntityForm({ kit, entities, existing, initial, onDone, onCancel }: Props) {
  const { t } = useI18n()
  const s = t.symfony
  const [name, setName] = useState(existing?.name ?? initial?.name ?? '')
  const [fields, setFields] = useState<SfField[]>(initial?.fields.length ? initial.fields : existing ? [] : [newField()])
  const [relations, setRelations] = useState<SfRelation[]>(initial?.relations ?? [])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const owner = existing?.name ?? name
  const targets = [...entities.map(e => e.name), ...(!existing && name && !entities.some(e => e.name === name) ? [name] : [])]

  const setField = (i: number, patch: Partial<SfField>) => setFields(list => list.map((f, j) => j === i ? { ...f, ...patch } : f))
  const setRelation = (i: number, patch: Partial<SfRelation>) => setRelations(list => list.map((r, j) => {
    if (j !== i) return r
    const next = { ...r, ...patch }
    // Names follow the target and the kind until the user types their own
    if ((patch.target || patch.kind) && (r.name === '' || r.name === suggestName(r.target, r.kind))) next.name = suggestName(next.target, next.kind)
    if ((patch.target || patch.kind) && (r.inverse === null || r.inverse === suggestInverse(owner, r.kind))) next.inverse = next.kind === 'OneToMany' || r.inverse !== null ? suggestInverse(owner, next.kind) : null
    return next
  }))
  const addRelation = () => {
    const target = entities[0]?.name ?? ''
    setRelations(list => [...list, { name: suggestName(target, 'ManyToOne'), kind: 'ManyToOne', target, inverse: suggestInverse(owner, 'ManyToOne'), nullable: false }])
  }

  const files = kit.files(owner, existing, [...new Set(relations.filter(r => r.inverse && r.target && r.target !== owner).map(r => r.target))])

  async function save() {
    setError('')
    const draft: SfEntityDraft = {
      name: owner, existing: !!existing,
      fields: fields.filter(f => f.name.trim()).map(f => ({ ...f, name: f.name.trim() })),
      relations: relations.map(r => ({ ...r, name: r.name.trim(), inverse: r.inverse?.trim() || null }))
    }
    setBusy(true)
    try { onDone(await kit.write(draft)) } catch (err) {
      const code = errorText(err)
      setError((s.errors as Record<string, string>)[code.split(':')[0]]?.replace('{name}', code.split(':')[1] ?? '') ?? code)
    } finally { setBusy(false) }
  }

  return (
    <Section title={existing ? s.addToTitle.replace('{name}', existing.name) : s.newEntityTitle} help={kit.help}>
      {!existing && (
        <label className="flex max-w-xs flex-col gap-1.5 text-sm text-fg-secondary">{s.entityName}
          <Input value={name} onChange={e => setName(e.target.value.replace(/\s/g, ''))} placeholder="Facture" spellCheck={false} autoFocus />
        </label>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">{s.fields}</h3>
        {fields.length > 0 && (
          <div role="group" aria-label={s.fields} className="flex flex-col overflow-hidden rounded-xl border border-line-subtle">
            <div aria-hidden className="grid grid-cols-[1.3fr_1.3fr_.9fr_.8fr_.8fr_32px] gap-2 bg-canvas px-3 py-2 text-xs text-fg-muted">
              <span>{s.fieldName}</span><span>{s.fieldType}</span><span>{s.fieldSize}</span>
              <span>{s.required}</span><span>{s.unique}</span><span />
            </div>
            {fields.map((f, i) => (
              <div key={i} className="grid grid-cols-[1.3fr_1.3fr_.9fr_.8fr_.8fr_32px] items-center gap-2 border-t border-line-subtle px-3 py-2">
                <Input aria-label={s.fieldName} value={f.name} onChange={e => setField(i, { name: e.target.value.replace(/\s/g, '') })} placeholder="numero" className="font-mono" spellCheck={false} />
                <Select aria-label={s.fieldType} value={f.type} onChange={e => setField(i, { type: e.target.value as SfFieldType })}>
                  {TYPES.map(ty => <option key={ty} value={ty}>{s.types[ty]}</option>)}
                </Select>
                {f.type === 'string'
                  ? <Input aria-label={s.fieldSize} type="number" min={1} max={65535} value={f.length ?? 255} onChange={e => setField(i, { length: Number(e.target.value) })} />
                  : f.type === 'decimal'
                    ? <Input aria-label={s.fieldSize} value={`${f.precision ?? 10},${f.scale ?? 2}`} onChange={e => { const [p, sc] = e.target.value.split(','); setField(i, { precision: Number(p) || 10, scale: Number(sc) || 0 }) }} />
                    : <span className="text-sm text-fg-muted">—</span>}
                <Checkbox checked={!f.nullable} onChange={v => setField(i, { nullable: !v })}><span className="sr-only">{s.required}</span></Checkbox>
                <Checkbox checked={f.unique} onChange={v => setField(i, { unique: v })}><span className="sr-only">{s.unique}</span></Checkbox>
                <IconButton size="sm" title={s.removeField} onClick={() => setFields(list => list.filter((_, j) => j !== i))}><X size={13} /></IconButton>
              </div>
            ))}
          </div>
        )}
        <div><Button size="sm" variant="ghost" onClick={() => setFields(list => [...list, newField()])}><Plus size={13} /> {s.addField}</Button></div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-fg">{s.relations}</h3>
        {relations.map((r, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-line-subtle bg-canvas p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-fg-secondary">
              <span>{s.relEach}</span><strong className="text-fg">{owner || '…'}</strong>
              <Select aria-label={s.relKind} value={r.kind} onChange={e => setRelation(i, { kind: e.target.value as SfRelationKind })} className="w-auto">
                {KINDS.map(k => <option key={k} value={k}>{s.kinds[k]}</option>)}
              </Select>
              <Select aria-label={s.relTarget} value={r.target} onChange={e => setRelation(i, { target: e.target.value })} className="w-auto">
                {targets.map(tg => <option key={tg} value={tg}>{tg}</option>)}
              </Select>
              <IconButton size="sm" title={s.removeRelation} onClick={() => setRelations(list => list.filter((_, j) => j !== i))} className="ml-auto"><X size={13} /></IconButton>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-fg-secondary">
              <label className="flex items-center gap-2">{s.relProperty}
                <Input value={r.name} onChange={e => setRelation(i, { name: e.target.value.replace(/\s/g, '') })} className="w-40 font-mono" spellCheck={false} />
              </label>
              {r.kind !== 'OneToMany' && (
                <Checkbox checked={r.inverse !== null} onChange={v => setRelation(i, { inverse: v ? suggestInverse(owner, r.kind) : null })}>{s.relBoth}</Checkbox>
              )}
              {r.inverse !== null && (
                <label className="flex items-center gap-2">{s.relInverse.replace('{target}', r.target)}
                  <Input value={r.inverse} onChange={e => setRelation(i, { inverse: e.target.value.replace(/\s/g, '') })} className="w-40 font-mono" spellCheck={false} />
                </label>
              )}
              {(r.kind === 'ManyToOne' || r.kind === 'OneToMany' || r.kind === 'OneToOne') && (
                <Checkbox checked={!r.nullable} onChange={v => setRelation(i, { nullable: !v })}>{s.relRequired}</Checkbox>
              )}
            </div>
            <p className="text-sm text-fg-muted">{relationSentence(s, owner || '…', r)}</p>
          </div>
        ))}
        <div><Button size="sm" variant="ghost" disabled={!targets.length} onClick={addRelation}><Plus size={13} /> {s.addRelation}</Button></div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-canvas p-3">
          <span className="text-xs text-fg-muted">{s.willWrite}</span>
          {files.map(f => <code key={f} className={f.startsWith('+') ? 'font-mono text-xs text-success' : 'font-mono text-xs text-warning'}>{f}</code>)}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>{t.common.cancel}</Button>
        <Button loading={busy} onClick={save}>{existing ? s.addToSave : s.createEntity}</Button>
      </div>
    </Section>
  )
}

type SfT = ReturnType<typeof useI18n>['t']['symfony']

/** The relation in plain words: "a Produit has one Categorie; a Categorie has several Produit" */
export function relationSentence(s: SfT, owner: string, r: SfRelation): string {
  return s.sentences[r.kind].replace(/\{owner\}/g, owner).replace(/\{target\}/g, r.target)
}
