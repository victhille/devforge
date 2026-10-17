import { useState } from 'react'
import { Plus, Trash2, Search } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import CopyButton from '@renderer/components/ui/CopyButton'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Input'
import { useSnippets, type Snippet } from './useSnippets'

const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'PHP', 'Java',
  'CSS', 'HTML', 'SQL', 'Bash', 'JSON', 'YAML', 'Markdown', 'Other'
]

interface Draft { title: string; language: string; code: string; tags: string }

const toDraft = (s: Snippet): Draft => ({ title: s.title, language: s.language, code: s.code, tags: s.tags.join(', ') })

export default function SnippetsPage() {
  const { t } = useI18n()
  const { snippets, create, update, remove } = useSnippets()
  const [selected, setSelected] = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [draft,    setDraft]    = useState<Draft | null>(null)
  const [dirty,    setDirty]    = useState(false)

  function select(s: Snippet) {
    setSelected(s.id)
    setDraft(toDraft(s))
    setDirty(false)
  }

  function edit(patch: Partial<Draft>) {
    setDraft(d => (d ? { ...d, ...patch } : d))
    setDirty(true)
  }

  function save() {
    if (!selected || !draft) return
    update(selected, {
      title: draft.title,
      language: draft.language,
      code: draft.code,
      tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    })
    setDirty(false)
  }

  function del() {
    if (!selected) return
    remove(selected)
    setSelected(null)
    setDraft(null)
  }

  const q = search.toLowerCase()
  const filtered = snippets.filter(s =>
    s.title.toLowerCase().includes(q) ||
    s.language.toLowerCase().includes(q) ||
    s.tags.some(tag => tag.toLowerCase().includes(q))
  )

  return (
    <div className="flex h-full">
      {/* ── List ── */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-line-subtle bg-surface">
        <div className="flex flex-col gap-2 border-b border-line-subtle p-3">
          <div className="relative">
            <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.snippets.search} className="h-8 pl-8 text-sm" />
          </div>
          <Button size="sm" onClick={() => select(create())}><Plus size={13} /> {t.snippets.newSnippet}</Button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-fg-muted">{search ? t.snippets.noMatch : t.snippets.noSnippets}</p>
          ) : filtered.map(s => (
            <button
              key={s.id}
              onClick={() => select(s)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors',
                selected === s.id ? 'bg-accent-soft' : 'hover:bg-hover'
              )}
            >
              <span className={cn('truncate font-medium', selected === s.id ? 'text-accent' : 'text-fg')}>{s.title}</span>
              <span className="flex flex-wrap gap-1">
                <Badge color="accent" className="py-0 text-2xs">{s.language}</Badge>
                {s.tags.slice(0, 2).map(tag => <Badge key={tag} className="py-0 text-2xs">{tag}</Badge>)}
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-line-subtle px-4 py-2 text-xs text-fg-muted">
          {t.snippets.subtitle.replace('{n}', String(snippets.length)).replace('{s}', snippets.length !== 1 ? 's' : '')}
        </div>
      </aside>

      {/* ── Editor ── */}
      <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        {!draft ? (
          <EmptyState
            className="flex-1"
            title={t.snippets.noSnippets}
            action={<Button onClick={() => select(create())}><Plus size={14} /> {t.snippets.newSnippet}</Button>}
          />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <input
                value={draft.title}
                onChange={e => edit({ title: e.target.value })}
                placeholder={t.snippets.titlePlaceholder}
                className="min-w-0 flex-1 bg-transparent text-xl font-semibold text-fg outline-none placeholder:text-fg-muted"
              />
              {dirty && <span className="text-xs italic text-warning">{t.snippets.unsaved}</span>}
              <CopyButton text={draft.code} title={t.snippets.copy} />
              <IconButton size="sm" tone="danger" title={t.snippets.delete} onClick={del}><Trash2 size={14} /></IconButton>
              <Button size="sm" onClick={save} disabled={!dirty}>{t.snippets.save}</Button>
            </div>

            <div className="flex gap-3">
              <Field label={t.snippets.labelLang} className="w-44">
                <Select value={draft.language} onChange={e => edit({ language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </Select>
              </Field>
              <Field label={t.snippets.labelTags} className="flex-1">
                <Input value={draft.tags} onChange={e => edit({ tags: e.target.value })} placeholder={t.snippets.tagsPlaceholder} />
              </Field>
            </div>

            <Field label={t.snippets.labelCode} className="min-h-0 flex-1">
              <Textarea
                value={draft.code}
                onChange={e => edit({ code: e.target.value })}
                spellCheck={false}
                className="flex-1 resize-none bg-surface"
              />
            </Field>
          </>
        )}
      </section>
    </div>
  )
}
