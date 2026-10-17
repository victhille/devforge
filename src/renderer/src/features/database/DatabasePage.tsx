import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Database, Eye, KeyRound, Pencil, Play, Plus, RefreshCw, Table2, Trash2 } from 'lucide-react'
import type { DbConnection, DbQueryResult, DbTable } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { SectionTitle } from '@renderer/components/ui/Page'
import DbConnectionForm from './DbConnectionForm'
import ResultGrid from './ResultGrid'

function quoteIdent(type: DbConnection['type'], t: DbTable): string {
  if (type === 'mysql') return `\`${t.name}\``
  if (type === 'postgres') return `"${t.schema}"."${t.name}"`
  return `"${t.name}"`
}

export default function DatabasePage() {
  const { t } = useI18n()
  const d = t.database
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [tables, setTables] = useState<DbTable[] | null>(null)
  const [schemaError, setSchemaError] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [sql, setSql] = useState('')
  const [result, setResult] = useState<DbQueryResult | null>(null)
  const [running, setRunning] = useState(false)
  const [form, setForm] = useState<{ conn?: DbConnection } | null>(null)

  const reloadConnections = useCallback(() => window.devforge.db.list().then(setConnections), [])
  useEffect(() => { reloadConnections() }, [reloadConnections])

  const conn = connections.find(c => c.id === active)

  const loadSchema = useCallback(async (id: string) => {
    setTables(null)
    setSchemaError('')
    try { setTables(await window.devforge.db.schema(id)) }
    catch (err) { setSchemaError(String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); setTables([]) }
  }, [])

  function select(id: string) {
    setActive(id)
    setResult(null)
    setSql('')
    loadSchema(id)
  }

  async function run(query = sql) {
    if (!active || !query.trim()) return
    setRunning(true)
    try { setResult(await window.devforge.db.query(active, query)) }
    finally { setRunning(false) }
    // Structure may have changed
    if (/^\s*(create|drop|alter)/i.test(query)) loadSchema(active)
  }

  function preview(table: DbTable) {
    if (!conn) return
    const q = `SELECT * FROM ${quoteIdent(conn.type, table)} LIMIT 100;`
    setSql(q)
    run(q)
  }

  const toggle = (key: string) => setOpen(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  return (
    <div className="flex h-full">
      {/* Connections + schema */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-line-subtle bg-surface">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-line-subtle px-3">
          <SectionTitle>{d.connections}</SectionTitle>
          <IconButton title={d.newTitle} onClick={() => setForm({})}><Plus size={15} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {connections.length === 0 && <p className="p-4 text-center text-sm text-fg-muted">{d.noConnections}</p>}
          {connections.map(c => (
            <div key={c.id}>
              <div className={cn('group flex items-center gap-2 rounded-lg px-2.5 py-2', active === c.id ? 'bg-active' : 'hover:bg-hover')}>
                <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => select(c.id)}>
                  <Database size={14} className="shrink-0" style={{ color: c.color }} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-fg">{c.name}</span>
                    <span className="truncate text-2xs text-fg-muted">{c.type === 'sqlite' ? 'SQLite' : `${c.type} · ${c.host}`}</span>
                  </span>
                </button>
                <span className="hidden gap-0.5 group-hover:flex">
                  <IconButton size="sm" title={d.edit} onClick={() => setForm({ conn: c })}><Pencil size={12} /></IconButton>
                  <IconButton size="sm" tone="danger" title={t.common.delete} onClick={async () => { await window.devforge.db.remove(c.id); if (active === c.id) setActive(null); reloadConnections() }}><Trash2 size={12} /></IconButton>
                </span>
              </div>

              {active === c.id && (
                <div className="mb-2 ml-3 border-l border-line-subtle pl-2">
                  <div className="flex items-center justify-between py-1 pr-1">
                    <span className="text-2xs uppercase tracking-wider text-fg-muted">{tables ? `${tables.length} ${d.tables}` : d.loading}</span>
                    <IconButton size="sm" title={t.common.refresh} onClick={() => loadSchema(c.id)}><RefreshCw size={11} /></IconButton>
                  </div>
                  {!tables && <Spinner className="m-2" />}
                  {schemaError && <p className="py-1 pr-2 text-xs text-danger">{schemaError}</p>}
                  {tables?.map(tb => {
                    const key = `${tb.schema}.${tb.name}`
                    return (
                      <div key={key}>
                        <div className="group/t flex items-center gap-1 rounded px-1 py-0.5 hover:bg-hover">
                          <button onClick={() => toggle(key)} className="text-fg-muted">{open.has(key) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</button>
                          {tb.type === 'view' ? <Eye size={12} className="text-fg-muted" /> : <Table2 size={12} className="text-fg-muted" />}
                          <button onClick={() => preview(tb)} className="flex-1 truncate text-left font-mono text-xs text-fg-secondary hover:text-fg">
                            {tb.schema && tb.schema !== 'public' ? `${tb.schema}.` : ''}{tb.name}
                          </button>
                        </div>
                        {open.has(key) && tb.columns.map(col => (
                          <div key={col.name} className="flex items-center gap-1.5 py-0.5 pl-7 font-mono text-2xs">
                            {col.key ? <KeyRound size={9} className="text-warning" /> : <span className="w-[9px]" />}
                            <span className="text-fg-secondary">{col.name}</span>
                            <span className="truncate text-fg-muted">{col.type}{col.nullable ? '' : ' !'}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Editor + results */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!conn ? (
          <div className="flex flex-1 p-8">
            <EmptyState className="flex-1" icon={<Database size={32} />} title={d.emptyTitle} description={d.emptyHint}
              action={<Button onClick={() => setForm({})}><Plus size={14} /> {d.newTitle}</Button>} />
          </div>
        ) : (
          <>
            <div className="flex shrink-0 flex-col border-b border-line-subtle">
              <textarea
                value={sql}
                onChange={e => setSql(e.target.value)}
                onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run() } }}
                placeholder={d.sqlPlaceholder}
                spellCheck={false}
                className="h-40 resize-y bg-canvas p-4 font-mono text-sm text-fg outline-none placeholder:text-fg-muted"
              />
              <div className="flex items-center gap-3 bg-surface px-4 py-2">
                <Button size="sm" onClick={() => run()} loading={running} disabled={!sql.trim()}>{!running && <Play size={13} />} {d.run}</Button>
                <span className="text-xs text-fg-muted">{d.shortcut}</span>
                <span className="ml-auto text-xs text-fg-muted">{d.limitHint}</span>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              {result ? <ResultGrid result={result} /> : <p className="p-6 text-sm text-fg-muted">{d.noResult}</p>}
            </div>
          </>
        )}
      </section>

      {form && (
        <DbConnectionForm
          initial={form.conn}
          onClose={() => setForm(null)}
          onSave={async c => {
            await window.devforge.db.save(c)
            await reloadConnections()
            setForm(null)
            if (active === c.id) loadSchema(c.id)
          }}
        />
      )}
    </div>
  )
}
