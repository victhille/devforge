import { useState } from 'react'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useCopy } from '@renderer/hooks/useCopy'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import CodeBlock from '@renderer/components/ui/CodeBlock'
import { codeLanguageByName as languageOf } from '@shared/lib/codeLanguage'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Field, Input, Select, Textarea } from '@renderer/components/ui/Input'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import { useSnippets, type Snippet } from './useSnippets'
import ToolHelp from '@renderer/components/ui/ToolHelp'
import { SNIPPET_EXAMPLE } from '../examples'
import SplitPane from '@renderer/components/ui/SplitPane'
import SearchInput from '@renderer/components/ui/SearchInput'
import { confirmDialog } from '@renderer/app/ConfirmContext'

const LANGUAGES = [
  'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'PHP', 'Java',
  'CSS', 'HTML', 'SQL', 'Bash', 'JSON', 'YAML', 'Markdown', 'Other'
]

interface Draft { title: string; language: string; code: string; tags: string }

const toDraft = (s: Snippet): Draft => ({ title: s.title, language: s.language, code: s.code, tags: s.tags.join(', ') })

/**
 * As in the mock-up: the snippets on the left (a search, the languages as
 * filters, each with its language and first tag), the chosen one on the
 * right in colours, Copy at hand; Edit turns it into the form.
 */
export default function SnippetsPage() {
  const { t } = useI18n()
  const s = t.snippets
  const { snippets, create, update, remove } = useSnippets()
  const [selected, setSelected] = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [lang,     setLang]     = useState<string | null>(null)
  const [draft,    setDraft]    = useState<Draft | null>(null)
  const [dirty,    setDirty]    = useState(false)
  const { copy, copied } = useCopy()
  const current = snippets.find(x => x.id === selected) ?? null

  function select(x: Snippet) {
    setSelected(x.id)
    setDraft(null)
    setDirty(false)
  }

  function startNew() {
    const x = create()
    setSelected(x.id)
    setDraft(toDraft(x))
    setDirty(false)
  }

  /** The example becomes a snippet only on demand */
  function fromExample() {
    const x = create()
    const patch = { title: SNIPPET_EXAMPLE.title, language: SNIPPET_EXAMPLE.language, code: SNIPPET_EXAMPLE.code, tags: SNIPPET_EXAMPLE.tags }
    update(x.id, patch)
    select({ ...x, ...patch })
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
    setDraft(null)
  }

  async function del() {
    if (!current || !(await confirmDialog(s.deleteConfirm.replace('{title}', current.title), { danger: true }))) return
    remove(current.id)
    setSelected(null)
    setDraft(null)
  }

  const q = search.toLowerCase()
  const languages = [...new Set(snippets.map(x => x.language))].sort((a, b) => a.localeCompare(b))
  const filtered = snippets.filter(x =>
    (!lang || x.language === lang) &&
    (x.title.toLowerCase().includes(q) || x.language.toLowerCase().includes(q) || x.tags.some(tag => tag.toLowerCase().includes(q)))
  )

  return (
    <SplitPane width="lg" label={s.title} sideClassName="df-mockup" side={<>
      <div className="flex flex-col gap-3 px-4 pt-4 pb-2">
        <SearchInput value={search} onChange={setSearch} placeholder={s.search} />
        {snippets.length > 0 && (
          <div role="radiogroup" aria-label={s.languages} className="flex flex-wrap gap-1.5">
            {[null, ...languages].map(l => {
              const on = lang === l
              return (
                <button key={l ?? 'all'} type="button" role="radio" aria-checked={on} onClick={() => setLang(l)}
                  className={cn('h-7 rounded-full border px-3 text-sm transition-colors',
                    on ? 'border-accent/50 bg-accent-soft font-semibold text-accent' : 'border-line text-fg-secondary hover:bg-hover hover:text-fg')}>
                  {l ?? <>{s.all} <span className="tabular-nums">{snippets.length}</span></>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-fg-muted">{search || lang ? s.noMatch : s.noSnippets}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {filtered.map(x => {
              const on = selected === x.id
              return (
                <li key={x.id}>
                  <button onClick={() => select(x)} aria-current={on ? 'true' : undefined}
                    className={cn('flex w-full flex-col gap-0.5 rounded-control px-2.5 py-2 text-left transition-colors', on ? 'bg-accent-soft' : 'hover:bg-hover')}>
                    <span className={cn('truncate', on ? 'font-semibold text-fg' : 'text-fg-secondary')} title={x.title}>{x.title}</span>
                    <span className="truncate text-xs text-fg-muted">{[x.language, x.tags[0]].filter(Boolean).join(' · ')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>}>
      <section className="df-mockup flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 pt-6.5 pb-8">
        {!draft && <ToolHelp id="snippets" what={t.toolHelp.snippets.what} how={t.toolHelp.snippets.how} />}

        {!current && snippets.length === 0 ? (
          // An example to look at: saved only if the user starts from it
          <div className="flex flex-col gap-3 rounded-card border border-dashed border-line p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t.toolHelp.example}</Badge>
              <span className="font-semibold text-fg-secondary">{SNIPPET_EXAMPLE.title}</span>
              <Badge mono>{SNIPPET_EXAMPLE.language}</Badge>
              {SNIPPET_EXAMPLE.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
            </div>
            <CodeBlock code={SNIPPET_EXAMPLE.code} language={languageOf(SNIPPET_EXAMPLE.language)} label={t.toolHelp.snippets.exampleTitle} />
            <p className="text-xs text-fg-muted">{t.toolHelp.snippets.exampleHint}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={fromExample}>{t.toolHelp.snippets.useExample}</Button>
              <Button size="sm" variant="secondary" onClick={startNew}><Plus size={13} aria-hidden /> {s.newSnippet}</Button>
            </div>
          </div>
        ) : !current ? (
          <EmptyState fill title={s.pick} action={<Button onClick={startNew}><Plus size={14} aria-hidden /> {s.newSnippet}</Button>} />
        ) : draft ? (
          // The form
          <>
            <header className="flex flex-wrap items-center gap-3">
              <input value={draft.title} onChange={e => edit({ title: e.target.value })} placeholder={s.titlePlaceholder} aria-label={s.labelTitle}
                className="min-w-0 flex-1 bg-transparent font-display text-page font-bold tracking-[-.025em] text-fg outline-none placeholder:text-fg-muted" />
              {dirty && <span className="text-sm text-warning italic">{s.unsaved}</span>}
              <Button variant="ghost" onClick={() => { setDraft(null); setDirty(false) }}>{t.common.cancel}</Button>
              <Button onClick={save} disabled={!dirty}>{s.save}</Button>
            </header>
            <div className="flex flex-wrap gap-3">
              <Field label={s.labelLang} className="w-44">
                <Select value={draft.language} onChange={e => edit({ language: e.target.value })}>
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </Select>
              </Field>
              <Field label={s.labelTags} className="min-w-[220px] flex-1">
                <Input value={draft.tags} onChange={e => edit({ tags: e.target.value })} placeholder={s.tagsPlaceholder} />
              </Field>
            </div>
            <Field label={s.labelCode} className="min-h-0 flex-1">
              <Textarea value={draft.code} onChange={e => edit({ code: e.target.value })} spellCheck={false}
                className="min-h-72 flex-1 resize-none bg-console font-mono text-sm" />
            </Field>
          </>
        ) : (
          // The snippet as it reads
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-1 text-sm text-fg-muted">{t.nav.groupTools} / {s.title}</p>
                <h1 className="truncate font-display text-page font-bold tracking-[-.025em] text-fg" title={current.title}>{current.title}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge mono>{current.language}</Badge>
                  {current.tags.map(tag => <Badge key={tag}>{tag}</Badge>)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" onClick={() => copy(current.code)}><Copy size={14} aria-hidden /> {copied ? s.copied : s.copy}</Button>
                <Button onClick={startNew}><Plus size={14} aria-hidden /> {s.newSnippet}</Button>
                <MoreMenu label={s.more} items={[
                  { label: s.edit, icon: Pencil, onSelect: () => setDraft(toDraft(current)) },
                  { label: s.delete, icon: Trash2, danger: true, onSelect: del }
                ]} />
              </div>
            </header>
            <CodeBlock code={current.code} language={languageOf(current.language)} label={s.codeOf.replace('{title}', current.title)} />
          </>
        )}
      </section>
    </SplitPane>
  )
}
