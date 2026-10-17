import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@renderer/lib/cn'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Input } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'
import { DOCS, type DocEntry } from './data'

function EntryCard({ entry }: { entry: DocEntry }) {
  return (
    <div className="group flex flex-col gap-1.5 rounded-lg border border-line-subtle bg-surface p-3 transition-colors hover:border-line">
      <div className="flex items-start justify-between gap-2">
        <code className="font-mono text-sm break-all text-fg">{entry.cmd}</code>
        <CopyButton text={entry.example ?? entry.cmd} className="opacity-0 group-hover:opacity-100" />
      </div>
      <span className="text-sm text-fg-secondary">{entry.desc}</span>
      {entry.example && (
        <div className="flex items-start justify-between gap-2 rounded-md bg-elevated px-2.5 py-1.5">
          <code className="font-mono text-xs break-all text-accent">{entry.example}</code>
          <CopyButton text={entry.example} />
        </div>
      )}
    </div>
  )
}

export default function DocsPage() {
  const [activeTech, setActiveTech] = useState(DOCS[0].id)
  const [search,     setSearch]     = useState('')

  const tech = DOCS.find(d => d.id === activeTech) ?? DOCS[0]

  const sections = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tech.sections
    return tech.sections
      .map(s => ({ ...s, entries: s.entries.filter(e => e.cmd.toLowerCase().includes(q) || e.desc.toLowerCase().includes(q)) }))
      .filter(s => s.entries.length > 0)
  }, [tech, search])

  return (
    <div className="flex h-full">
      {/* Tech list */}
      <aside className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line-subtle bg-surface p-2">
        <SectionTitle className="px-2 pt-1 pb-2">Référence rapide</SectionTitle>
        {DOCS.map(doc => (
          <button
            key={doc.id}
            onClick={() => { setActiveTech(doc.id); setSearch('') }}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors',
              activeTech === doc.id ? 'bg-hover text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
            )}
          >
            <FrameworkIcon name={doc.id} size={14} className="shrink-0" style={{ color: doc.color }} />
            <span>{doc.name}</span>
          </button>
        ))}
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line-subtle px-8 py-4">
          <h1 className="flex items-center gap-2.5 text-xl font-semibold" style={{ color: tech.color }}>
            <FrameworkIcon name={tech.id} size={20} />
            {tech.name}
          </h1>
          <div className="relative w-72">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <Input
              placeholder={`Rechercher dans ${tech.name}…`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-7 overflow-y-auto px-8 py-6">
          {sections.map(section => (
            <section key={section.title} className="flex flex-col gap-2.5">
              <SectionTitle>{section.title}</SectionTitle>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2">
                {section.entries.map((entry, i) => <EntryCard key={`${entry.cmd}-${i}`} entry={entry} />)}
              </div>
            </section>
          ))}
          {sections.length === 0 && (
            <EmptyState icon={<Search size={28} />} title={`Aucun résultat pour « ${search} »`} />
          )}
        </div>
      </div>
    </div>
  )
}
