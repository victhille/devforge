import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { CustomCommand } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { Input } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'
import { DOCS } from './data'
import CommandForm from './CommandForm'
import { techIdFor, withCustom, type Entry } from './withCustom'
import { errorText } from '@renderer/lib/errors'

function EntryCard({ entry, onEdit, onRemove }: { entry: Entry; onEdit?: () => void; onRemove?: () => void }) {
  const { t } = useI18n()
  return (
    <div className="group flex flex-col gap-1.5 rounded-lg border border-line-subtle bg-surface p-3 transition-colors hover:border-line">
      <div className="flex items-start justify-between gap-2">
        <code className="font-mono text-sm break-words text-fg">{entry.cmd}</code>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
          {onEdit && <IconButton size="sm" title={t.docsCustom.edit} onClick={onEdit}><Pencil size={12} /></IconButton>}
          {onRemove && <IconButton size="sm" tone="danger" title={t.docsCustom.remove} onClick={onRemove}><Trash2 size={12} /></IconButton>}
          <CopyButton text={entry.example ?? entry.cmd} />
        </div>
      </div>
      {entry.desc && <span className="text-sm text-fg-secondary">{entry.desc}</span>}
      {entry.example && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-elevated px-2.5 py-1.5">
          <code className="font-mono text-xs break-words text-accent">{entry.example}</code>
          <CopyButton text={entry.example} />
        </div>
      )}
    </div>
  )
}

export default function DocsPage() {
  const { t } = useI18n()
  const d = t.docsCustom
  const toast = useToast()
  const [custom, setCustom] = useState<CustomCommand[]>([])
  const [activeTech, setActiveTech] = useState(DOCS[0].id)
  const [search,     setSearch]     = useState('')
  /** The form: a new command (null) or one to change */
  const [editing, setEditing] = useState<CustomCommand | null | undefined>(undefined)

  useEffect(() => { window.devforge.docs.list().then(setCustom).catch(() => {}) }, [])

  const docs = useMemo(() => withCustom(DOCS, custom, d.mine), [custom, d.mine])
  const tech = docs.find(x => x.id === activeTech) ?? docs[0]

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tech.sections
    return tech.sections
      .map(s => ({ ...s, entries: s.entries.filter(e => e.cmd.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)) }))
      .filter(s => s.entries.length > 0)
  }, [tech, search])

  async function save(c: Partial<CustomCommand>) {
    try {
      setCustom(await window.devforge.docs.save(c))
      // Show the command where it went
      setActiveTech(techIdFor(DOCS, c.category ?? ''))
      setSearch('')
      setEditing(undefined)
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  async function remove(c: CustomCommand) {
    if (!window.confirm(d.removeConfirm.replace('{cmd}', c.cmd))) return
    setCustom(await window.devforge.docs.remove(c.id))
  }

  return (
    <div className="flex h-full">
      {/* Tech list */}
      <aside className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line-subtle bg-surface p-2">
        <SectionTitle className="px-2 pt-1 pb-2">{d.reference}</SectionTitle>
        {docs.map(doc => (
          <button
            key={doc.id}
            onClick={() => { setActiveTech(doc.id); setSearch('') }}
            aria-current={activeTech === doc.id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors',
              activeTech === doc.id ? 'bg-hover text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
            )}
          >
            <FrameworkIcon name={doc.id} size={14} className="shrink-0" style={{ color: doc.color }} />
            <span className="truncate">{doc.name}</span>
          </button>
        ))}
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-line-subtle px-8 py-4">
          <h1 className="flex items-center gap-2.5 text-xl font-semibold" style={{ color: tech.color }}>
            <FrameworkIcon name={tech.id} size={20} />
            {tech.name}
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative w-72">
              <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
              <Input
                placeholder={d.searchIn.replace('{name}', tech.name)}
                aria-label={d.searchIn.replace('{name}', tech.name)}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button onClick={() => setEditing(null)}><Plus size={14} /> {d.add}</Button>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-8 py-6">
          {sections.map(section => (
            <section key={section.title} className="flex flex-col gap-2.5">
              <SectionTitle>{section.title}</SectionTitle>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2">
                {section.entries.map((entry: Entry, i) => (
                  <EntryCard key={`${entry.cmd}-${i}`} entry={entry}
                    onEdit={entry.custom ? () => setEditing(entry.custom!) : undefined}
                    onRemove={entry.custom ? () => remove(entry.custom!) : undefined} />
                ))}
              </div>
            </section>
          ))}
          {sections.length === 0 && (
            <EmptyState icon={<Search size={28} />} title={d.noResult.replace('{q}', search)} />
          )}
        </div>
      </div>

      {editing !== undefined && (
        <CommandForm
          initial={editing ?? undefined}
          categories={docs.map(x => x.name)}
          commands={docs.flatMap(x => x.sections.flatMap(s => s.entries.map(e => e.cmd)))}
          defaultCategory={tech.name}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  )
}
