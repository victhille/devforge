import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { CustomCommand } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { DOCS } from './data'
import CommandForm from './CommandForm'
import { techIdFor, withCustom, type Entry } from './withCustom'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import SplitPane from '@renderer/components/ui/SplitPane'
import SearchInput from '@renderer/components/ui/SearchInput'

/** A command's row, as in the mock-up: the command, what it does, copy (and edit, delete for one of yours) */
function EntryRow({ entry, onEdit, onRemove }: { entry: Entry; onEdit?: () => void; onRemove?: () => void }) {
  const { t } = useI18n()
  return (
    <li className="group grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 border-b border-line-subtle py-3 last:border-0">
      <div className="flex min-w-0 flex-col gap-1">
        <code className="font-mono text-sm break-words text-accent">{entry.cmd}</code>
        {entry.example && <code className="font-mono text-xs break-words text-fg-muted">{entry.example}</code>}
      </div>
      <span className="text-sm text-fg-secondary">{entry.desc}</span>
      <span className="flex items-center gap-0.5">
        {(onEdit || onRemove) && (
          <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
            {onEdit && <IconButton size="sm" title={t.docsCustom.editCmd.replace('{cmd}', entry.cmd)} onClick={onEdit}><Pencil size={13} /></IconButton>}
            {onRemove && <IconButton size="sm" tone="danger" title={t.docsCustom.removeCmd.replace('{cmd}', entry.cmd)} onClick={onRemove}><Trash2 size={13} /></IconButton>}
          </span>
        )}
        <CopyButton text={entry.example ?? entry.cmd} title={t.docsCustom.copyCmd.replace('{cmd}', entry.example ?? entry.cmd)} />
      </span>
    </li>
  )
}

/**
 * As in the mock-up: the technologies on the left with their number of
 * commands, the chosen one's sections on the right, each a card of rows.
 */
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
  const countOf = (doc: (typeof docs)[number]) => doc.sections.reduce((n, s) => n + s.entries.length, 0)

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
    if (!(await confirmDialog(d.removeConfirm.replace('{cmd}', c.cmd), { danger: true }))) return
    setCustom(await window.devforge.docs.remove(c.id))
  }

  return (
    <SplitPane width="lg" label={d.reference} sideClassName="df-mockup" side={<>
      <div className="flex h-14 shrink-0 items-center px-4">
        <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{d.reference}</h2>
      </div>
      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {docs.map(doc => {
          const on = activeTech === doc.id
          return (
            <li key={doc.id}>
              <button onClick={() => { setActiveTech(doc.id); setSearch('') }} aria-current={on ? 'page' : undefined}
                className={cn('flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-left transition-colors',
                  on ? 'bg-accent-soft text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
                <span className={cn('min-w-0 flex-1 truncate', on && 'font-semibold')} title={doc.name}>{doc.name}</span>
                <span className="shrink-0 text-xs text-fg-muted tabular-nums">{countOf(doc)}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </>}>
      <div className="df-mockup flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-8 pt-6.5 pb-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-sm text-fg-muted">{t.nav.groupTools} / {t.nav.docs}</p>
            <h1 className="truncate font-display text-page font-bold tracking-[-.025em] text-fg">{tech.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SearchInput className="w-64" placeholder={d.searchIn.replace('{name}', tech.name)} value={search} onChange={setSearch} />
            <Button variant="secondary" onClick={() => setEditing(null)}><Plus size={14} aria-hidden /> {d.add}</Button>
          </div>
        </header>

        <div className="flex flex-col gap-4">
          {sections.map((section, i) => (
            <section key={section.title} aria-label={section.title} className="df-rise rounded-card border border-line-subtle bg-surface px-5 pt-4 pb-1" style={{ '--i': i } as CSSProperties}>
              <h2 className="text-xs font-semibold tracking-wider text-fg-muted uppercase">{section.title}</h2>
              <ul>
                {section.entries.map((entry: Entry, j) => (
                  <EntryRow key={`${entry.cmd}-${j}`} entry={entry}
                    onEdit={entry.custom ? () => setEditing(entry.custom!) : undefined}
                    onRemove={entry.custom ? () => remove(entry.custom!) : undefined} />
                ))}
              </ul>
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
    </SplitPane>
  )
}
