import { useId, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { ArrowUpRight, ChevronDown, Code2, Search, Square, Table2 } from 'lucide-react'
import type { DbTable, DbTableRef, DbType } from '@shared/types'
import { DB_SEARCH_MODES, matchRanges, searchProblem, searchSql, searchedColumns, snippet } from '@shared/lib/dbSearch'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import EmptyState from '@renderer/components/ui/EmptyState'
import Notice from '@renderer/components/ui/Notice'
import SearchInput from '@renderer/components/ui/SearchInput'
import Spinner from '@renderer/components/ui/Spinner'
import { Input, Select } from '@renderer/components/ui/Input'
import { searchTargets, tableKey, type DbSearch, type TableHit } from './useDbSearch'

interface Props {
  dbType: DbType
  tables: DbTable[] | null
  search: DbSearch
  onOpenTable: (ref: DbTableRef) => void
  /** The search of one table, every row, in the SQL tab */
  onShowSql: (sql: string) => void
}

/**
 * The whole database searched at once, as phpMyAdmin does, made easier:
 * one field, a mode, the case, a column and the tables if need be; then each
 * table that holds the term, its rows with the term lit and the columns it is in first.
 */
export default function SearchPanel({ dbType, tables, search, onOpenTable, onShowSql }: Props) {
  const { t, lang } = useI18n()
  const s = t.dbSearch
  const { form, setForm, run, running } = search
  const [picking, setPicking] = useState(false)
  const [tableFilter, setTableFilter] = useState('')
  const [problem, setProblem] = useState('')
  const columnsId = useId()
  const tablesId = useId()
  const all = useMemo(() => tables ?? [], [tables])

  const picked = useMemo(() => new Set(form.tables ?? all.filter(tb => tb.type === 'table').map(tableKey)), [form.tables, all])
  const columnNames = useMemo(() => [...new Set(all.filter(tb => picked.has(tableKey(tb))).flatMap(tb => tb.columns.map(c => c.name)))].sort((a, b) => a.localeCompare(b)), [all, picked])
  const shownTables = tableFilter.trim() ? all.filter(tb => tb.name.toLowerCase().includes(tableFilter.trim().toLowerCase())) : all

  function update(patch: Partial<typeof form>) {
    setProblem('')
    setForm({ ...form, ...patch })
  }

  function toggleTable(key: string) {
    const next = new Set(picked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    update({ tables: [...next] })
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    if (running) return
    const p = searchProblem(form)
    if (p) { setProblem(p === 'empty' ? s.needTerm : p === 'tooLong' ? s.tooLong : p === 'risky' ? s.riskyRegex : s.badRegex.replace('{error}', p.regex)); return }
    const targets = searchTargets(all, form)
    if (!targets.length) { setProblem(form.column.trim() ? s.noColumn.replace('{name}', form.column.trim()) : s.pickTables); return }
    setProblem('')
    search.start(targets)
  }

  const tablesLabel = form.tables === null
    ? s.tablesAll.replace('{n}', String(all.filter(tb => tb.type === 'table').length))
    : s.tablesSome.replace('{n}', String(picked.size)).replace('{total}', String(all.length))

  return (
    <div className="flex flex-1 flex-col gap-5">
      {/* The search: the term and its button, then how and where to look */}
      <form onSubmit={submit} role="search" aria-label={s.title} className="df-rise flex flex-col gap-3.5 rounded-card border border-line-subtle bg-surface p-5">
        <div className="flex items-center gap-2">
          <SearchInput value={form.term} onChange={term => update({ term })} placeholder={s.placeholder} autoFocus className="h-10 min-w-0 flex-1" />
          {running
            ? <Button type="button" variant="secondary" size="lg" className="shrink-0" onClick={search.stop}><Square size={13} aria-hidden /> {s.stop}</Button>
            : <Button type="submit" size="lg" className="shrink-0" disabled={!tables}><Search size={14} aria-hidden /> {s.run}</Button>}
        </div>

        <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Select value={form.mode} onChange={e => update({ mode: e.target.value as typeof form.mode })} aria-label={s.mode} className="h-8 w-auto">
            {DB_SEARCH_MODES.map(m => <option key={m} value={m}>{s.modes[m]}</option>)}
          </Select>
          <Checkbox checked={form.caseSensitive} onChange={caseSensitive => update({ caseSensitive })}>{s.caseSensitive}</Checkbox>
          <label className="flex items-center gap-2 text-fg-secondary">
            {s.column}
            <Input list={columnsId} value={form.column} onChange={e => update({ column: e.target.value })} placeholder={s.columnAll} className="h-8 w-52" />
            <datalist id={columnsId}>{columnNames.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <button type="button" aria-expanded={picking} aria-controls={tablesId} onClick={() => setPicking(v => !v)}
            className="-mx-1.5 flex items-center gap-1.5 rounded-control px-1.5 py-1 text-fg-secondary transition-colors hover:bg-hover hover:text-fg">
            {s.tablesLabel} <span className="font-semibold text-fg">{tablesLabel}</span>
            <ChevronDown size={14} aria-hidden className={cn('transition-transform', picking && 'rotate-180')} />
          </button>
        </div>
        <p className="text-sm text-fg-muted">{s.hints[form.mode]}</p>
        </div>

        {picking && (
          <fieldset id={tablesId} className="flex flex-col gap-3 rounded-control border border-line-subtle bg-canvas p-3.5">
            <legend className="sr-only">{s.tables}</legend>
            <div className="flex flex-wrap items-center gap-3">
              {all.length > 12 && <SearchInput value={tableFilter} onChange={setTableFilter} placeholder={t.database.filterTables} className="h-8 w-64" />}
              <button type="button" onClick={() => update({ tables: null })} className="text-sm font-medium text-accent hover:underline">{s.allTables}</button>
              <button type="button" onClick={() => update({ tables: [] })} className="text-sm font-medium text-accent hover:underline">{s.noTables}</button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-2">
              {shownTables.map(tb => (
                <Checkbox key={tableKey(tb)} checked={picked.has(tableKey(tb))} onChange={() => toggleTable(tableKey(tb))} className="min-w-0 text-sm">
                  <span className="min-w-0 truncate font-mono">{tb.schema && tb.schema !== 'public' ? `${tb.schema}.` : ''}{tb.name}</span>
                  {tb.type === 'view' && <Badge>{s.view}</Badge>}
                </Checkbox>
              ))}
            </div>
          </fieldset>
        )}

        {problem && <Notice tone="warning" role="alert">{problem}</Notice>}
      </form>

      {run ? <Results run={run} running={running} tables={all} dbType={dbType} onOpenTable={onOpenTable} onShowSql={onShowSql} lang={lang} />
        : <EmptyState fill icon={<Search size={32} />} title={s.emptyTitle} description={s.emptyHint} />}
    </div>
  )
}

function Results({ run, running, tables, dbType, onOpenTable, onShowSql, lang }: {
  run: NonNullable<DbSearch['run']>
  running: boolean
  tables: DbTable[]
  dbType: DbType
  onOpenTable: (ref: DbTableRef) => void
  onShowSql: (sql: string) => void
  lang: string
}) {
  const { t } = useI18n()
  const s = t.dbSearch
  const found = run.hits.filter(h => !h.result.error && !h.result.skipped && h.result.total > 0)
  const failed = run.hits.filter(h => h.result.error)
  const empty = run.hits.filter(h => !h.result.error && !h.result.skipped && h.result.total === 0)
  const rows = found.reduce((n, h) => n + h.result.total, 0)
  const time = run.durationMs === null ? '' : run.durationMs < 1000 ? `${run.durationMs} ms` : `${(run.durationMs / 1000).toLocaleString(lang, { maximumFractionDigits: 1 })} s`

  const summary = run.stopped
    ? s.stopped.replace('{n}', String(run.searched)).replace('{total}', String(run.count))
    : rows
      ? s.summary.replace('{rows}', rows.toLocaleString(lang)).replace('{tables}', String(found.length)).replace('{searched}', String(run.searched)).replace('{time}', time)
      // No table could be read: « nothing found » would not be true
      : failed.length && failed.length === run.searched ? s.allFailed
        : s.nothing.replace('{q}', run.form.term)
  // The same error in every table (the connection lost…) said once, with the tables it hit
  const errors = [...failed.reduce((m, h) => m.set(h.result.error!, [...(m.get(h.result.error!) ?? []), h.ref.name]), new Map<string, string[]>())]

  return (
    <section aria-label={s.results} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
      <div className="flex min-h-6 flex-wrap items-center gap-2 text-sm text-fg-secondary">
        {running && (
          <>
            <Spinner />
            <span>{s.progress.replace('{table}', run.current ?? '').replace('{i}', String(run.searched + 1)).replace('{n}', String(run.count))}</span>
          </>
        )}
        <p role="status" className={cn(!rows && !running && !run.stopped && 'font-semibold text-fg')}>{running ? '' : summary}</p>
      </div>
      {!running && !rows && !run.stopped && !failed.length && <p className="text-sm text-fg-muted">{s.nothingHint}</p>}
      </div>

      {found.map(hit => <HitCard key={hit.key} hit={hit} run={run} table={tables.find(tb => tableKey(tb) === hit.key)} dbType={dbType} onOpenTable={onOpenTable} onShowSql={onShowSql} lang={lang} />)}

      {failed.length > 0 && (
        <Notice tone="danger" title={s.failed} live>
          <ul className="flex flex-col gap-1">
            {errors.map(([error, names]) => <li key={error}><span className="font-mono font-semibold">{names.join(', ')}</span> — {error}</li>)}
          </ul>
        </Notice>
      )}
      {!running && empty.length > 0 && rows > 0 && (
        <p className="text-sm text-fg-muted">{s.noneIn} <span className="font-mono">{empty.map(h => h.ref.name).join(', ')}</span></p>
      )}
    </section>
  )
}

function HitCard({ hit, run, table, dbType, onOpenTable, onShowSql, lang }: {
  hit: TableHit
  run: NonNullable<DbSearch['run']>
  table: DbTable | undefined
  dbType: DbType
  onOpenTable: (ref: DbTableRef) => void
  onShowSql: (sql: string) => void
  lang: string
}) {
  const { t } = useI18n()
  const s = t.dbSearch
  const { columns, rows, total } = hit.result
  const searched = new Set(searchedColumns(columns, run.form.column))
  // Where the term is, cell by cell
  const marks = useMemo(() => rows.map(r => r.map((v, ci) => (v !== null && v !== undefined && searched.has(columns[ci]) ? matchRanges(String(v), run.form) : []))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, columns, run.form])
  const matched = columns.filter((_, ci) => marks.some(m => m[ci].length))
  // The key first, then the columns the term is in, then the others
  const keys = (table?.columns ?? []).filter(c => c.key).map(c => c.name).filter(c => columns.includes(c))
  const order = [...new Set([...keys, ...matched, ...columns])].map(c => columns.indexOf(c))
  const sql = () => searchSql(dbType, hit.ref, [...searched], run.form)

  return (
    <article aria-label={hit.ref.name} className="df-rise overflow-hidden rounded-card border border-line-subtle bg-surface">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle px-4 py-3">
        <Table2 size={15} aria-hidden className="text-fg-muted" />
        <h2 className="font-mono text-base font-semibold text-fg">{hit.ref.schema && hit.ref.schema !== 'public' ? `${hit.ref.schema}.` : ''}{hit.ref.name}</h2>
        <Badge>{s.rows.replace('{n}', total.toLocaleString(lang))}</Badge>
        {matched.length > 0 && <span className="text-sm text-fg-muted">{s.foundIn} <span className="font-mono text-fg-secondary">{matched.join(', ')}</span></span>}
        <span className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onShowSql(sql())}><Code2 size={13} aria-hidden /> {s.showSql}</Button>
          <Button size="sm" variant="secondary" onClick={() => onOpenTable(hit.ref)}><ArrowUpRight size={13} aria-hidden /> {s.openTable}</Button>
        </span>
      </header>
      {/* A wide table scrolls: it can be reached with the keyboard */}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={s.rowsOf.replace('{name}', hit.ref.name)}>
        <table className="w-max min-w-full border-collapse text-sm">
          <caption className="sr-only">{s.rowsOf.replace('{name}', hit.ref.name)}</caption>
          <thead>
            <tr className="bg-surface">
              {order.map(ci => (
                <th key={columns[ci]} scope="col" className={cn('px-3.5 py-2.5 text-left text-xs font-medium whitespace-nowrap', matched.includes(columns[ci]) ? 'text-accent' : 'text-fg-muted')}>
                  {columns[ci]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-line-subtle hover:bg-hover">
                {order.map(ci => (
                  <td key={columns[ci]} className="px-3.5 py-2.5 align-top font-mono text-sm whitespace-nowrap text-fg" title={typeof r[ci] === 'string' && (r[ci] as string).length > 90 ? (r[ci] as string).slice(0, 1000) : undefined}>
                    <Marked value={r[ci]} ranges={marks[ri][ci]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > rows.length && (
        <p className="flex flex-wrap items-center gap-x-2 border-t border-line-subtle px-4 py-2.5 text-sm text-fg-muted">
          {s.firstRows.replace('{shown}', String(rows.length)).replace('{total}', total.toLocaleString(lang))}
          <button type="button" onClick={() => onShowSql(sql())} className="font-medium text-accent hover:underline">{s.seeAll}</button>
        </p>
      )}
    </article>
  )
}

/** A value with the term lit, cut around it when long */
function Marked({ value, ranges }: { value: unknown; ranges: [number, number][] }) {
  if (value === null || value === undefined) return <span className="text-fg-muted italic">NULL</span>
  const { text, ranges: at } = snippet(String(value), ranges)
  const parts: ReactNode[] = []
  let from = 0
  for (const [a, b] of at) {
    if (a > from) parts.push(text.slice(from, a))
    parts.push(<mark key={a} className="rounded-sm bg-accent/25 text-fg">{text.slice(a, b)}</mark>)
    from = b
  }
  if (from < text.length) parts.push(text.slice(from))
  return <>{parts}</>
}

