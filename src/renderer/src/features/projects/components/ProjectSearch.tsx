import { useEffect, useState } from 'react'
import { CaseSensitive, Regex, Search, WholeWord, X } from 'lucide-react'
import type { SearchResult } from '@shared/lib/projectSearch'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Spinner from '@renderer/components/ui/Spinner'

export interface SearchHit { path: string; line: number }

/** A toggle of the search: case, whole word, regex */
function Toggle({ on, onChange, title, children }: { on: boolean; onChange: (v: boolean) => void; title: string; children: React.ReactNode }) {
  return (
    <button aria-pressed={on} title={title} aria-label={title} onClick={() => onChange(!on)}
      className={cn('flex size-6 shrink-0 items-center justify-center rounded', on ? 'bg-accent-soft text-accent' : 'text-fg-muted hover:bg-hover hover:text-fg')}>
      {children}
    </button>
  )
}

/**
 * v3.6 lot 5: the search of the Files tab: a text or a regex in the whole
 * project, 300 ms after the last key; the results replace the tree.
 */
export function useProjectSearch(root: string) {
  const [query, setQuery] = useState('')
  const [regex, setRegex] = useState(false)
  const [caseSensitive, setCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [include, setInclude] = useState('')
  const [result, setResult] = useState<SearchResult | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!query) { setResult(null); setBusy(false); return }
    let alive = true
    setBusy(true)
    const id = setTimeout(() => {
      window.devforge.searchProject(root, query, { regex, caseSensitive, wholeWord, include })
        .then(r => { if (alive && r.error !== 'CANCELLED') { setResult(r); setBusy(false) } })
        .catch(() => { if (alive) setBusy(false) })
    }, 300)
    return () => { alive = false; clearTimeout(id) }
  }, [root, query, regex, caseSensitive, wholeWord, include])

  return { query, setQuery, regex, setRegex, caseSensitive, setCase, wholeWord, setWholeWord, include, setInclude, result, busy, active: !!query }
}

export function SearchBar({ s }: { s: ReturnType<typeof useProjectSearch> }) {
  const { t } = useI18n()
  const f = t.files
  return (
    <div className="flex shrink-0 flex-col gap-1 border-b border-line-subtle p-2">
      <label className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-canvas px-2 focus-within:border-accent">
        <Search size={13} className="shrink-0 text-fg-muted" aria-hidden />
        <input value={s.query} onChange={e => s.setQuery(e.target.value)} placeholder={f.searchPlaceholder} aria-label={f.searchPlaceholder} spellCheck={false}
          onKeyDown={e => { if (e.key === 'Escape') s.setQuery('') }}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-fg outline-none placeholder:font-sans placeholder:text-fg-muted" />
        {s.query && <button onClick={() => s.setQuery('')} title={f.searchClear} aria-label={f.searchClear} className="text-fg-muted hover:text-fg"><X size={12} /></button>}
        <Toggle on={s.caseSensitive} onChange={s.setCase} title={f.searchCase}><CaseSensitive size={14} /></Toggle>
        <Toggle on={s.wholeWord} onChange={s.setWholeWord} title={f.searchWord}><WholeWord size={14} /></Toggle>
        <Toggle on={s.regex} onChange={s.setRegex} title={f.searchRegex}><Regex size={14} /></Toggle>
      </label>
      {s.active && (
        <input value={s.include} onChange={e => s.setInclude(e.target.value)} placeholder={f.searchInclude} aria-label={f.searchInclude} spellCheck={false}
          className="h-7 rounded-md border border-line-subtle bg-canvas px-2 font-mono text-[11.5px] text-fg outline-none placeholder:font-sans placeholder:text-fg-muted focus:border-accent" />
      )}
    </div>
  )
}

/** The results, by file; a click opens the line */
export function SearchResults({ s, selected, onOpen }: { s: ReturnType<typeof useProjectSearch>; selected: SearchHit | null; onOpen: (hit: SearchHit) => void }) {
  const { t } = useI18n()
  const f = t.files
  const r = s.result
  if (!r) return s.busy ? <Spinner className="m-4" /> : null
  if (r.error) return <p role="alert" className="px-3 py-3 font-mono text-xs text-danger">{f.searchInvalid} {r.error}</p>
  return (
    <div className="flex flex-col" data-testid="search-results">
      <p role="status" className="flex items-center gap-2 px-2 py-1.5 text-2xs text-fg-muted">
        {r.total === 0 ? f.searchNone : f.searchCount.replace('{n}', String(r.total)).replace('{files}', String(r.files.length))}
        {r.truncated && <span className="text-warning">{f.searchTruncated}</span>}
        {s.busy && <Spinner />}
      </p>
      {r.files.map(file => (
        <div key={file.path} className="mb-1">
          <div className="truncate px-2 py-0.5 font-mono text-[11.5px] font-semibold text-fg" title={file.path}>
            {file.path} <span className="font-normal text-fg-muted">({file.matches.length})</span>
          </div>
          {file.matches.map((m, i) => {
            const on = selected?.path === file.path && selected.line === m.line
            return (
              <button key={i} onClick={() => onOpen({ path: file.path, line: m.line })} aria-current={on ? 'true' : undefined}
                className={cn('flex w-full items-baseline gap-2 rounded px-2 py-0.5 text-left font-mono text-[11.5px] hover:bg-hover', on && 'bg-accent-soft')}>
                <span className="w-8 shrink-0 text-right text-fg-muted">{m.line}</span>
                <span className="truncate text-fg-secondary">
                  {m.text.slice(0, m.column).trimStart()}
                  <mark className="rounded-sm bg-warning-soft px-px text-fg">{m.text.slice(m.column, m.column + m.length)}</mark>
                  {m.text.slice(m.column + m.length)}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
