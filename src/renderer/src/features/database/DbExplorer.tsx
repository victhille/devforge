import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft, ChevronDown, ChevronRight, Code2, Eye, Info, KeyRound, LayoutGrid, Link2, ListTree,
  PanelLeftClose, PanelLeftOpen, Plus, RefreshCw, Rows3, Table2
} from 'lucide-react'
import type { DbConnection, DbOverview, DbTable, DbTableDetails, DbTableRef } from '@shared/types'
import { quoteIdent } from '@shared/lib/sqlQuote'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { formatSize } from '@renderer/lib/format'
import OverviewView from './OverviewView'
import SqlPanel from './SqlPanel'
import { BrowseTab, InfoTab, RelationsTab, StructureTab } from './TableTabs'
import { CreateTableDialog } from './TableDialogs'

type Tab = 'overview' | 'browse' | 'structure' | 'relations' | 'info' | 'sql'

const errorText = (err: unknown) =>
  String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

const sameTable = (a: DbTableRef | null, b: DbTableRef | null) => !!a && !!b && a.name === b.name && a.schema === b.schema

/**
 * One database: its tables, then overview, rows, structure, relations, info
 * and SQL. On the Database page, and in a project's Database tab (v3.3 lot 1).
 * Mount it with `key={conn.id}`: a new connection starts from its overview.
 */
export default function DbExplorer({ conn, back, actions }: {
  conn: DbConnection
  /** "← Back to the project" when the page was opened from one */
  back?: { label: string; onClick: () => void }
  /** Extra buttons next to Refresh (the project tab's "Open full size") */
  actions?: ReactNode
}) {
  const { t } = useI18n()
  const d = t.database
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
  const [collapsed, setCollapsed] = usePersistentState('devforge:db-tables-collapsed', false)
  const [creating, setCreating] = useState(false)

  const loadSchema = useCallback(async () => {
    setTables(null)
    setSchemaError('')
    try { setTables(await window.devforge.db.schema(conn.id)) }
    catch (err) { setSchemaError(errorText(err)); setTables([]) }
  }, [conn.id])

  const loadOverview = useCallback(async () => {
    setOverview(null)
    setViewError('')
    try { setOverview(await window.devforge.db.overview(conn.id)) }
    catch (err) { setViewError(errorText(err)) }
  }, [conn.id])

  // Connects when shown, not before
  useEffect(() => { loadSchema(); loadOverview() }, [loadSchema, loadOverview])

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
    if (!table || !['structure', 'relations', 'info'].includes(tab)) return
    if (details && sameTable(table, detailsFor)) return
    let alive = true
    setDetails(null)
    setViewError('')
    window.devforge.db.details(conn.id, table)
      .then(r => { if (alive) { setDetails(r); setDetailsFor(table) } })
      .catch(err => { if (alive) setViewError(errorText(err)) })
    return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.id, table, tab, rev])

  function changeTab(next: Tab) {
    // SQL on a table starts from a SELECT on it
    if (next === 'sql' && table && !sql.trim()) setSql(`SELECT * FROM ${quoteIdent(conn.type, table)} LIMIT 100;`)
    setTab(next)
  }

  function refresh() {
    loadSchema()
    loadOverview()
    setDetailsFor(null)
    setDetails(null)
    setRev(r => r + 1)
  }

  /** v3.5.1: a table created, renamed or dropped here */
  function afterTableChange(next: DbTableRef | null) {
    refresh()
    if (next) openTable(next, 'structure')
    else { setTable(null); setTab('overview') }
  }

  // Structure only (no row data): what the user is looking at
  useAssistantPageContext({
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
  })

  const toggle = (key: string) => setOpen(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })

  const shownTables = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? tables?.filter(tb => `${tb.schema}.${tb.name}`.toLowerCase().includes(f)) : tables
  }, [tables, filter])

  const dbName = overview?.database || conn.database || conn.name

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
    <div className="flex h-full min-h-0">
      {/* Tables (collapsible: more room for the data) */}
      <aside aria-label={d.tables} className={cn('flex shrink-0 flex-col border-r border-line-subtle bg-sidebar transition-[width] duration-200', collapsed ? 'w-11' : 'w-[230px]')}>
        <div className={cn('flex h-11 shrink-0 items-center border-b border-line-subtle', collapsed ? 'justify-center' : 'justify-between pr-1.5 pl-3')}>
          {!collapsed && <span className="text-2xs uppercase tracking-wider text-fg-muted">{tables ? `${tables.length} ${d.tables}` : d.loading}</span>}
          <span className="flex items-center">
            {!collapsed && <IconButton size="sm" title={d.newTable} onClick={() => setCreating(true)}><Plus size={14} /></IconButton>}
            <IconButton size="sm" title={collapsed ? d.showTables : d.hideTables} onClick={() => setCollapsed(c => !c)}>
              {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            </IconButton>
          </span>
        </div>
        {!collapsed && (
          <div className="flex-1 overflow-y-auto p-1.5">
            {tables && tables.length > 8 && (
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder={d.filterTables} aria-label={d.filterTables}
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
      </aside>

      {/* Explorer */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="df-rise flex shrink-0 flex-col gap-4 px-7 pt-6">
          {back && (
            <button onClick={back.onClick} className="flex items-center gap-1.5 self-start text-sm text-fg-secondary hover:text-fg">
              <ArrowLeft size={14} /> {back.label}
            </button>
          )}
          {/* Breadcrumb, table name and actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[200px] flex-1">
              <nav className="flex min-w-0 items-center gap-1.5 font-mono text-[11.5px] text-fg-muted">
                <span>{conn.type}</span>
                <ChevronRight size={11} />
                <button onClick={() => { setTable(null); setTab('overview') }} className="truncate hover:text-fg">{dbName}</button>
                {table?.schema && <><ChevronRight size={11} /><span>{table.schema}</span></>}
              </nav>
              <h1 className="mt-0.5 flex items-center gap-2 truncate text-2xl font-semibold tracking-[-.02em] text-fg">
                {table ? table.name : dbName}
              </h1>
            </div>
            {actions}
            <Button variant="secondary" size="sm" onClick={refresh}><RefreshCw size={13} /> {t.common.refresh}</Button>
            <Button size="sm" onClick={() => changeTab('sql')}><Code2 size={13} /> {d.newQuery}</Button>
          </div>

          {/* Tabs, underlined */}
          <div role="tablist" className="flex gap-1 border-b border-line">
            {tabItems.map(item => (
              <button key={item.value} role="tab" aria-selected={tab === item.value} onClick={() => changeTab(item.value)}
                className={cn('flex h-9 items-center gap-1.5 border-b-2 px-3.5 text-base font-medium transition-colors',
                  tab === item.value ? 'border-accent text-fg' : 'border-transparent text-fg-secondary hover:text-fg')}>
                {item.icon} {item.label}
              </button>
            ))}
          </div>

          {/* Key figures of the open table */}
          {table && details && sameTable(table, detailsFor) && (
            <div className="flex flex-wrap gap-3">
              {[
                [d.rowsEstimate, details.stats?.rows != null ? details.stats.rows.toLocaleString() : '—'],
                [d.size, details.stats?.dataBytes != null ? formatSize((details.stats.dataBytes ?? 0) + (details.stats.indexBytes ?? 0)) : '—'],
                [d.statIndexes, String(details.indexes.length)],
                [d.statForeignKeys, details.foreignKeys.length ? `${details.foreignKeys.length} → ${details.foreignKeys[0].table}` : '0']
              ].map(([label, value]) => (
                <div key={label} className="min-w-[140px] flex-1 rounded-xl border border-line-subtle bg-surface px-3.5 py-3">
                  <div className="font-mono text-[11px] text-fg-muted uppercase">{label}</div>
                  <div className="mt-0.5 truncate text-xl font-semibold text-fg">{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div key={`${table?.schema}.${table?.name}:${rev}`} className={cn('flex min-h-0 flex-1 flex-col', tab !== 'browse' && tab !== 'sql' && 'overflow-y-auto')}>
          {viewError && tab !== 'browse' && tab !== 'sql' ? (
            <div className="m-5 rounded-lg bg-danger-soft p-3 text-sm text-danger">{d.loadFailed} : {viewError}</div>
          ) : tab === 'overview' ? (
            overview ? <OverviewView overview={overview} onOpenTable={tb => openTable(tb)} /> : <Spinner className="m-6" />
          ) : tab === 'sql' ? (
            <SqlPanel connId={conn.id} sql={sql} onSql={setSql} onSchemaChange={() => { loadSchema(); loadOverview() }} />
          ) : table && tab === 'browse' ? (
            <BrowseTab conn={conn} table={table} />
          ) : !details || !sameTable(table, detailsFor) ? (
            <Spinner className="m-6" />
          ) : tab === 'structure' ? (
            <StructureTab details={details} conn={conn} table={table ?? undefined} onChanged={refresh}
              onRenamed={name => afterTableChange({ name, schema: table?.schema ?? '' })} onDropped={() => afterTableChange(null)} />
          ) : tab === 'relations' && table ? (
            <RelationsTab details={details} table={table} onOpenTable={openTableByName} />
          ) : (
            <InfoTab details={details} />
          )}
        </div>
      </section>
      {creating && <CreateTableDialog conn={conn} onClose={() => setCreating(false)} onDone={name => { setCreating(false); afterTableChange({ name, schema: table?.schema ?? '' }) }} />}
    </div>
  )
}
