import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Code2, Eye, Network, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw, Table2 } from 'lucide-react'
import type { DbConnection, DbOverview, DbTable, DbTableDetails, DbTableRef } from '@shared/types'
import { quoteIdent } from '@shared/lib/sqlQuote'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import MoreMenu from '@renderer/components/ui/MoreMenu'
import Spinner from '@renderer/components/ui/Spinner'
import SearchInput from '@renderer/components/ui/SearchInput'
import OverviewView from './OverviewView'
import SqlPanel from './SqlPanel'
import { BrowseTab, InfoTab, RelationsTab, StructureTab } from './TableTabs'
import { CreateTableDialog } from './TableDialogs'
import SchemaView from './SchemaView'
import { errorText } from '@renderer/lib/errors'
import ErrorState from '@renderer/components/ui/ErrorState'
import { ENGINE_NAME } from './engines'
import Tabs from '@renderer/components/ui/Tabs'

type Tab = 'overview' | 'browse' | 'structure' | 'relations' | 'info' | 'sql'

const sameTable = (a: DbTableRef | null, b: DbTableRef | null) => !!a && !!b && a.name === b.name && a.schema === b.schema

/**
 * One database: its tables, then overview, rows, structure, relations, info
 * and SQL. On the Database page, and in a project's Database tab (v3.3 lot 1).
 * Mount it with `key={conn.id}`: a new connection starts from its overview.
 * On the Database page its tables go under the connection, in the page's
 * panel (`tablesSlot`), as in the mock-up; elsewhere they have their own.
 */
export default function DbExplorer({ conn, back, actions, tablesSlot }: {
  conn: DbConnection
  /** "← Back to the project" when the page was opened from one */
  back?: { label: string; onClick: () => void }
  /** Extra buttons next to the tabs (the project tab's "Open full size") */
  actions?: ReactNode
  /** Where the list of tables goes, in the page's own panel (undefined: a panel of its own) */
  tablesSlot?: HTMLElement | null
}) {
  const { t, lang } = useI18n()
  const d = t.database
  const [tables, setTables] = useState<DbTable[] | null>(null)
  const [schemaError, setSchemaError] = useState('')
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
  const [schemaOpen, setSchemaOpen] = useState(false)

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

  const shownTables = useMemo(() => {
    const f = filter.trim().toLowerCase()
    return f ? tables?.filter(tb => `${tb.schema}.${tb.name}`.toLowerCase().includes(f)) : tables
  }, [tables, filter])

  const dbName = overview?.database || conn.database || conn.name
  // Rows of each table, from the overview (an estimate on big engines)
  const rowsOf = useMemo(() => new Map(overview?.tables.map(x => [`${x.schema}.${x.name}`, x.rows]) ?? []), [overview])

  const tabItems = table
    ? [
        { value: 'browse' as Tab,    label: d.tabBrowse },
        { value: 'structure' as Tab, label: d.tabStructure },
        { value: 'relations' as Tab, label: d.tabRelations },
        { value: 'info' as Tab,      label: d.tabInfo },
        { value: 'sql' as Tab,       label: d.tabSql }
      ]
    : [
        { value: 'overview' as Tab, label: d.tabOverview },
        { value: 'sql' as Tab,      label: d.tabSql }
      ]

  /** The tables: a line each, its icon, name and rows; the open one lit */
  const tablesList = (
    <div className="flex flex-col gap-0.5">
      {tables && tables.length > 8 && (
        <SearchInput value={filter} onChange={setFilter} placeholder={d.filterTables} className="mb-1 h-8" />
      )}
      {!tables && <Spinner className="m-2" />}
      {schemaError && <p className="py-1 pr-2 text-sm text-danger">{schemaError}</p>}
      {tables?.length === 0 && !schemaError && <p className="px-2.5 py-1.5 text-sm text-fg-muted">{d.noTables}</p>}
      <ul aria-label={d.tablesOf.replace('{name}', conn.name)} className="flex flex-col gap-0.5">
        {shownTables?.map(tb => {
          const key = `${tb.schema}.${tb.name}`
          const selected = sameTable(table, tb)
          const rows = rowsOf.get(key)
          return (
            <li key={key}>
              <button onClick={() => openTable(tb)} aria-current={selected ? 'true' : undefined}
                className={cn('flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left transition-colors', selected ? 'bg-accent-soft text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
                {tb.type === 'view' ? <Eye size={14} aria-hidden className="shrink-0 text-fg-muted" /> : <Table2 size={14} aria-hidden className={cn('shrink-0', selected ? 'text-fg' : 'text-fg-muted')} />}
                <span className={cn('min-w-0 flex-1 truncate text-base', selected && 'font-semibold')}>
                  {tb.schema && tb.schema !== 'public' ? `${tb.schema}.` : ''}{tb.name}
                </span>
                {rows != null && <span className="shrink-0 font-mono text-xs text-fg-muted tabular-nums">{rows.toLocaleString(lang)}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div className="flex h-full min-h-0">
      {/* On the Database page, under the connection in its panel; elsewhere a panel of its own */}
      {tablesSlot !== undefined ? (tablesSlot && createPortal(tablesList, tablesSlot)) : (
        <aside aria-label={d.tablesLabel} className={cn('flex shrink-0 flex-col border-r border-line-subtle bg-surface transition-[width] duration-200', collapsed ? 'w-11' : 'w-[240px]')}>
          <div className={cn('flex h-12 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pr-1.5 pl-3.5')}>
            {!collapsed && <span className="text-xs font-semibold tracking-wider text-fg-muted uppercase">{tables ? `${tables.length} ${d.tables}` : d.loading}</span>}
            <span className="flex items-center">
              {!collapsed && <IconButton size="sm" title={d.newTable} onClick={() => setCreating(true)}><Plus size={14} /></IconButton>}
              <IconButton size="sm" title={collapsed ? d.showTables : d.hideTables} onClick={() => setCollapsed(c => !c)}>
                {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </IconButton>
            </span>
          </div>
          {!collapsed && <div className="flex-1 overflow-y-auto px-2 pb-2">{tablesList}</div>}
        </aside>
      )}

      {/* The table or the database on show */}
      <section className="df-mockup flex min-w-0 flex-1 flex-col">
        <div className="df-rise flex shrink-0 flex-col gap-3 px-8 pt-6.5 pb-5">
          {back && (
            <button onClick={back.onClick} className="flex items-center gap-1.5 self-start text-sm text-fg-secondary hover:text-fg">
              <ArrowLeft size={14} aria-hidden /> {back.label}
            </button>
          )}
          {/* Narrow, the views and actions go under the title together, never one by one */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="min-w-[200px] flex-1">
              <nav aria-label={t.nav.breadcrumb} className="mb-1 flex min-w-0 items-center gap-1.5 text-sm text-fg-muted">
                <span className="shrink-0">{t.nav.groupData}</span>
                <span aria-hidden>/</span>
                {table
                  ? <button onClick={() => { setTable(null); setTab('overview') }} className="min-w-0 truncate hover:text-fg">{conn.name} ({ENGINE_NAME[conn.type]})</button>
                  : <span className="min-w-0 truncate">{conn.name} ({ENGINE_NAME[conn.type]})</span>}
                {table?.schema && table.schema !== 'public' && <><span aria-hidden>/</span><span className="shrink-0 font-mono text-xs">{table.schema}</span></>}
              </nav>
              <h1 className="truncate font-display text-page font-bold tracking-[-.025em] text-fg" title={table ? table.name : dbName}>{table ? table.name : dbName}</h1>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {actions}
              <Tabs<Tab> items={tabItems} value={tab} onChange={changeTab} label={d.views} />
              <Button variant="secondary" onClick={() => setSchemaOpen(true)}><Network size={14} aria-hidden /> {t.schema.button}</Button>
              <MoreMenu label={d.more} items={[
                { label: t.common.refresh, icon: RefreshCw, onSelect: refresh },
                { label: d.newTable, icon: Plus, onSelect: () => setCreating(true) },
                { label: d.newQuery, icon: Code2, onSelect: () => changeTab('sql') }
              ]} />
            </div>
          </div>
        </div>

        <div key={`${table?.schema}.${table?.name}:${rev}`} className={cn('flex min-h-0 flex-1 flex-col px-8 pb-8', tab !== 'browse' && tab !== 'sql' && 'overflow-y-auto')}>
          {viewError && tab !== 'browse' && tab !== 'sql' ? (
            <ErrorState title={d.loadFailed} error={viewError} />
          ) : tab === 'overview' ? (
            overview ? <OverviewView overview={overview} onOpenTable={tb => openTable(tb)} /> : <Spinner className="m-6" />
          ) : tab === 'sql' ? (
            <SqlPanel connId={conn.id} sql={sql} onSql={setSql} onSchemaChange={() => { loadSchema(); loadOverview() }} />
          ) : table && tab === 'browse' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line-subtle bg-surface"><BrowseTab conn={conn} table={table} /></div>
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
      {schemaOpen && <SchemaView conn={conn} dbName={dbName} onClose={() => setSchemaOpen(false)} onOpenTable={ref => { setSchemaOpen(false); openTable(ref, 'structure') }} />}
      {creating && <CreateTableDialog conn={conn} onClose={() => setCreating(false)} onDone={name => { setCreating(false); afterTableChange({ name, schema: table?.schema ?? '' }) }} />}
    </div>
  )
}
