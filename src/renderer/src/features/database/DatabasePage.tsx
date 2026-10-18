import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronDown, ChevronRight, Code2, Database, Eye, Info, KeyRound, LayoutGrid, Link2, ListTree,
  PanelLeftClose, PanelLeftOpen, Pencil, Plus, RefreshCw, Rows3, Search, Table2, Trash2
} from 'lucide-react'
import type { DbConnection, DbOverview, DbTable, DbTableDetails, DbTableRef } from '@shared/types'
import { quoteIdent } from '@shared/lib/sqlQuote'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import Tabs from '@renderer/components/ui/Tabs'
import { SectionTitle } from '@renderer/components/ui/Page'
import DbConnectionForm from './DbConnectionForm'
import DetectDialog from './DetectDialog'
import OverviewView from './OverviewView'
import SqlPanel from './SqlPanel'
import { BrowseTab, InfoTab, RelationsTab, StructureTab } from './TableTabs'

type Tab = 'overview' | 'browse' | 'structure' | 'relations' | 'info' | 'sql'

const errorText = (err: unknown) =>
  String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

const sameTable = (a: DbTableRef | null, b: DbTableRef | null) => !!a && !!b && a.name === b.name && a.schema === b.schema

export default function DatabasePage() {
  const { t } = useI18n()
  const d = t.database
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [tables, setTables] = useState<DbTable[] | null>(null)
  const [schemaError, setSchemaError] = useState('')
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [table, setTable] = useState<DbTableRef | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [overview, setOverview] = useState<DbOverview | null>(null)
  const [details, setDetails] = useState<DbTableDetails | null>(null)
  const [detailsFor, setDetailsFor] = useState<DbTableRef | null>(null)
  /** Bumped by "refresh": reloads the open view */
  const [rev, setRev] = useState(0)
  const [viewError, setViewError] = useState('')
  const [sql, setSql] = useState('')
  const [collapsed, setCollapsed] = usePersistentState('devforge:db-panel-collapsed', false)
  const [form, setForm] = useState<{ conn?: DbConnection } | null>(null)
  const [params, setParams] = useSearchParams()
  const [detect, setDetect] = useState<{ server?: string } | null>(() => (params.get('detect') ? { server: params.get('detect')! } : null))

  const reloadConnections = useCallback(() => window.devforge.db.list().then(setConnections), [])
  useEffect(() => { reloadConnections() }, [reloadConnections])

  const conn = connections.find(c => c.id === active)

  const loadSchema = useCallback(async (id: string) => {
    setTables(null)
    setSchemaError('')
    try { setTables(await window.devforge.db.schema(id)) }
    catch (err) { setSchemaError(errorText(err)); setTables([]) }
  }, [])

  const loadOverview = useCallback(async (id: string) => {
    setOverview(null)
    setViewError('')
    try { setOverview(await window.devforge.db.overview(id)) }
    catch (err) { setViewError(errorText(err)) }
  }, [])

  function select(id: string) {
    setActive(id)
    setTable(null)
    setTab('overview')
    setSql('')
    setFilter('')
    loadSchema(id)
    loadOverview(id)
  }

  function openTable(ref: DbTableRef, nextTab: Tab = 'browse') {
    setTable({ name: ref.name, schema: ref.schema })
    setTab(nextTab)
  }

  /** From a foreign key: "table", "schema.table" or quoted names */
  function openTableByName(raw: string) {
    const parts = raw.split('.').map(p => p.replace(/^"|"$/g, ''))
    const name = parts.pop()!
    const schema = parts.pop()
    const found = tables?.find(tb => tb.name === name && (!schema || tb.schema === schema)) ?? tables?.find(tb => tb.name === name)
    if (found) openTable(found, 'structure')
  }

  // Details feed the structure, relations and info tabs
  useEffect(() => {
    if (!active || !table || !['structure', 'relations', 'info'].includes(tab)) return
    if (details && sameTable(table, detailsFor)) return
    let alive = true
    setDetails(null)
    setViewError('')
    window.devforge.db.details(active, table)
      .then(r => { if (alive) { setDetails(r); setDetailsFor(table) } })
      .catch(err => { if (alive) setViewError(errorText(err)) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, table, tab, rev])

  function changeTab(next: Tab) {
    // SQL on a table starts from a SELECT on it
    if (next === 'sql' && table && conn && !sql.trim()) setSql(`SELECT * FROM ${quoteIdent(conn.type, table)} LIMIT 100;`)
    setTab(next)
  }

  function refresh() {
    if (!active) return
    loadSchema(active)
    loadOverview(active)
    setDetailsFor(null)
    setDetails(null)
    setRev(r => r + 1)
  }

  // Structure only (no row data): what the user is looking at
  useAssistantPageContext(conn ? {
    label: `${conn.name}${table ? ` › ${table.name}` : ''}`,
    content: [
      `Connection: ${conn.name} (${conn.type}${conn.type === 'sqlite' ? '' : `, database ${overview?.database ?? conn.database ?? ''}`}${overview ? `, ${overview.version}` : ''})`,
      table && details && sameTable(table, detailsFor)
        ? [
            `Table ${table.schema ? `${table.schema}.` : ''}${table.name}`,
            ...details.columns.map(c => `  ${c.name} ${c.type}${c.nullable ? '' : ' NOT NULL'}${c.key ? ` ${c.key}` : ''}${c.default !== null ? ` DEFAULT ${c.default}` : ''}${c.extra ? ` ${c.extra}` : ''}`),
            'Indexes:', ...details.indexes.map(i => `  ${i.name} (${i.columns.join(', ')})${i.primary ? ' PRIMARY' : i.unique ? ' UNIQUE' : ''}`),
            'Foreign keys:', ...details.foreignKeys.map(f => `  (${f.columns.join(', ')}) → ${f.table}(${f.refColumns.join(', ')}) ON DELETE ${f.onDelete}`),
            'Referenced by:', ...details.referencedBy.map(f => `  ${f.table}(${f.columns.join(', ')})`)
          ].join('\n')
        : overview ? ['Tables:', ...overview.tables.map(t => `  ${t.schema && t.schema !== 'public' ? `${t.schema}.` : ''}${t.name} (${t.type}, ~${t.rows ?? '?'} rows)`)].join('\n') : '',
      tab === 'sql' && sql.trim() ? `Current SQL:\n${sql.slice(0, 4000)}` : ''
    ].filter(Boolean).join('\n')
  } : null)

  const toggle = (key: string) => setOpen(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const shownTables = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? tables?.filter(tb => `${tb.schema}.${tb.name}`.toLowerCase().includes(f)) : tables
  }, [tables, filter])

  const tabItems = table
    ? [
        { value: 'browse' as Tab,    label: d.tabBrowse,    icon: <Rows3 size={13} /> },
        { value: 'structure' as Tab, label: d.tabStructure, icon: <ListTree size={13} /> },
        { value: 'relations' as Tab, label: d.tabRelations, icon: <Link2 size={13} /> },
        { value: 'info' as Tab,      label: d.tabInfo,      icon: <Info size={13} /> },
        { value: 'sql' as Tab,       label: d.tabSql,       icon: <Code2 size={13} /> }
      ]
    : [
        { value: 'overview' as Tab, label: d.tabOverview, icon: <LayoutGrid size={13} /> },
        { value: 'sql' as Tab,      label: d.tabSql,      icon: <Code2 size={13} /> }
      ]

  return (
    <div className="flex h-full">
      {/* Connections + tables (collapsible: more room for the data) */}
      <aside className={cn('flex shrink-0 flex-col border-r border-line-subtle bg-surface transition-[width] duration-200', collapsed ? 'w-14' : 'w-72')}>
        <div className={cn('flex h-11 shrink-0 items-center border-b border-line-subtle', collapsed ? 'justify-center' : 'justify-between px-3')}>
          {!collapsed && <SectionTitle>{d.connections}</SectionTitle>}
          <span className="flex gap-0.5">
            {!collapsed && <IconButton title={d.detectTitle} onClick={() => setDetect({})}><Search size={14} /></IconButton>}
            {!collapsed && <IconButton title={d.newTitle} onClick={() => setForm({})}><Plus size={15} /></IconButton>}
            <IconButton title={collapsed ? d.showPanel : d.hidePanel} onClick={() => setCollapsed(c => !c)}>
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </IconButton>
          </span>
        </div>

        {collapsed ? (
          <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
            {connections.map(c => (
              <button key={c.id} onClick={() => select(c.id)} title={`${c.name} — ${c.type}`}
                className={cn('flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-hover', active === c.id && 'bg-active')}>
                <Database size={16} style={{ color: c.color }} />
              </button>
            ))}
            <IconButton title={d.newTitle} onClick={() => setForm({})} className="mt-1"><Plus size={15} /></IconButton>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-1.5">
            {connections.length === 0 && <p className="p-4 text-center text-sm text-fg-muted">{d.noConnections}</p>}
            {connections.map(c => (
              <div key={c.id}>
                <div className={cn('group flex items-center gap-2 rounded-lg px-2.5 py-2', active === c.id ? 'bg-active' : 'hover:bg-hover')}>
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => select(c.id)}>
                    <Database size={14} className="shrink-0" style={{ color: c.color }} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-fg">{c.name}</span>
                      <span className="truncate text-2xs text-fg-muted">{c.type === 'sqlite' ? 'SQLite' : `${c.type} · ${c.host}${c.sshConnectionId ? ' · SSH' : ''}`}</span>
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
                      <IconButton size="sm" title={t.common.refresh} onClick={refresh}><RefreshCw size={11} /></IconButton>
                    </div>
                    {tables && tables.length > 8 && (
                      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={d.filterTables}
                        className="mb-1 h-7 w-full rounded-md border border-line-subtle bg-canvas px-2 text-xs text-fg outline-none placeholder:text-fg-muted focus:border-accent" />
                    )}
                    {!tables && <Spinner className="m-2" />}
                    {schemaError && <p className="py-1 pr-2 text-xs text-danger">{schemaError}</p>}
                    {shownTables?.map(tb => {
                      const key = `${tb.schema}.${tb.name}`
                      const selected = sameTable(table, tb)
                      return (
                        <div key={key}>
                          <div className={cn('group/t flex items-center gap-1 rounded px-1 py-0.5', selected ? 'bg-accent-soft' : 'hover:bg-hover')}>
                            <button onClick={() => toggle(key)} className="text-fg-muted" aria-label={tb.name}>{open.has(key) ? <ChevronDown size={11} /> : <ChevronRight size={11} />}</button>
                            {tb.type === 'view' ? <Eye size={12} className="text-fg-muted" /> : <Table2 size={12} className={selected ? 'text-accent' : 'text-fg-muted'} />}
                            <button onClick={() => openTable(tb)}
                              className={cn('flex-1 truncate text-left font-mono text-xs', selected ? 'text-accent' : 'text-fg-secondary hover:text-fg')}>
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
        )}
      </aside>

      {/* Explorer */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!conn ? (
          <div className="flex flex-1 p-8">
            <EmptyState className="flex-1" icon={<Database size={32} />} title={d.emptyTitle} description={d.emptyHint}
              action={
                <div className="flex gap-2">
                  <Button onClick={() => setDetect({})}><Search size={14} /> {d.detectTitle}</Button>
                  <Button variant="secondary" onClick={() => setForm({})}><Plus size={14} /> {d.newTitle}</Button>
                </div>
              } />
          </div>
        ) : (
          <>
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line-subtle bg-surface px-4 py-2">
              <nav className="flex min-w-0 items-center gap-1.5 text-sm">
                <button onClick={() => { setTable(null); setTab('overview') }}
                  className={cn('flex min-w-0 items-center gap-1.5 truncate font-medium', table ? 'text-fg-secondary hover:text-fg' : 'text-fg')}>
                  <Database size={14} style={{ color: conn.color }} className="shrink-0" />
                  <span className="truncate">{overview?.database || conn.database || conn.name}</span>
                </button>
                {table && (
                  <>
                    <ChevronRight size={13} className="shrink-0 text-fg-muted" />
                    <span className="flex items-center gap-1.5 truncate font-mono font-medium text-fg">
                      <Table2 size={13} className="shrink-0 text-accent" />
                      {table.schema && table.schema !== 'public' ? `${table.schema}.` : ''}{table.name}
                    </span>
                  </>
                )}
              </nav>
              <Tabs<Tab> value={tab} onChange={changeTab} items={tabItems} className="ml-auto" />
            </div>

            <div key={`${active}:${table?.schema}.${table?.name}:${rev}`} className={cn('flex min-h-0 flex-1 flex-col', tab !== 'browse' && tab !== 'sql' && 'overflow-y-auto')}>
              {viewError && tab !== 'browse' && tab !== 'sql' ? (
                <div className="m-5 rounded-lg bg-danger-soft p-3 text-sm text-danger">{d.loadFailed} : {viewError}</div>
              ) : tab === 'overview' ? (
                overview ? <OverviewView overview={overview} onOpenTable={tb => openTable(tb)} /> : <Spinner className="m-6" />
              ) : tab === 'sql' ? (
                <SqlPanel connId={conn.id} sql={sql} onSql={setSql} onSchemaChange={() => { loadSchema(conn.id); loadOverview(conn.id) }} />
              ) : table && tab === 'browse' ? (
                <BrowseTab connId={conn.id} table={table} />
              ) : !details || !sameTable(table, detailsFor) ? (
                <Spinner className="m-6" />
              ) : tab === 'structure' ? (
                <StructureTab details={details} />
              ) : tab === 'relations' && table ? (
                <RelationsTab details={details} table={table} onOpenTable={openTableByName} />
              ) : (
                <InfoTab details={details} />
              )}
            </div>
          </>
        )}
      </section>

      {detect && (
        <DetectDialog
          initialServer={detect.server}
          onClose={() => { setDetect(null); if (params.has('detect')) setParams({}, { replace: true }) }}
          onAdded={async id => { await reloadConnections(); select(id) }}
        />
      )}

      {form && (
        <DbConnectionForm
          initial={form.conn}
          onClose={() => setForm(null)}
          onSave={async c => {
            await window.devforge.db.save(c)
            await reloadConnections()
            setForm(null)
            if (active === c.id) select(c.id)
          }}
        />
      )}
    </div>
  )
}
