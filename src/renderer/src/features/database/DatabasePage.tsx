import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Database, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { DbConnection } from '@shared/types'
import { NO_CONNECTIONS, useDbConnections, useProjectList } from '@renderer/hooks/useLiveData'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { PageHeader } from '@renderer/components/ui/Page'
import { useActiveHub } from '@renderer/hooks/useActiveHub'
import { confirmDialog } from '@renderer/app/ConfirmContext'
import DbConnectionForm from './DbConnectionForm'
import DetectDialog from './DetectDialog'
import DbExplorer from './DbExplorer'
import { ENGINE_NAME } from './engines'

/**
 * As in the mock-up: one panel with the connections, the open one unfolding
 * its tables (the explorer puts them there), and the table on the right.
 */
export default function DatabasePage() {
  const { t } = useI18n()
  const d = t.database
  // v4.2: the kept list of connections, read again when one is saved or removed (here, by Forgy…)
  const { data, reload: reloadConnections } = useDbConnections()
  const connections = data ?? NO_CONNECTIONS
  const [active, setActive] = useState<string | null>(null)
  const [collapsed, setCollapsed] = usePersistentState('devforge:db-panel-collapsed', false)
  const [form, setForm] = useState<{ conn?: DbConnection } | null>(null)
  /** Bumped when the open connection is edited: its explorer starts again */
  const [rev, setRev] = useState(0)
  const [params, setParams] = useSearchParams()
  const [detect, setDetect] = useState<{ server?: string } | null>(() => (params.get('detect') ? { server: params.get('detect')! } : null))
  /** Under the open connection: where its tables go */
  const [tablesSlot, setTablesSlot] = useState<HTMLElement | null>(null)

  // ?conn=<id>: opened from a project page
  const wantedConn = useRef(params.get('conn'))
  useEffect(() => {
    const id = wantedConn.current
    if (id && connections.some(c => c.id === id)) { wantedConn.current = null; setActive(id) }
  }, [connections])

  const conn = connections.find(c => c.id === active)

  // ?from=<project id>: "← Back to the project", on its Database tab
  const navigate = useNavigate()
  // v4.2: from the kept list of projects (the page's first address only)
  const fromId = useRef(params.get('from')).current
  const fromProject = useProjectList().data?.find(x => x.id === fromId)
  const from = fromId && fromProject ? { id: fromProject.id, name: fromProject.name } : null

  // Active project only (its linked databases)
  const activeHub = useActiveHub()
  const [onlyActive, setOnlyActive] = usePersistentState('devforge:db-only-active', false)
  const filterOn = onlyActive && !!activeHub?.databases.length
  const shownConnections = filterOn ? connections.filter(c => activeHub!.databases.some(d => d.id === c.id)) : connections

  async function remove(c: DbConnection) {
    if (!(await confirmDialog(d.removeConfirm.replace('{name}', c.name), { danger: true }))) return
    await window.devforge.db.remove(c.id)
    if (active === c.id) setActive(null)
    reloadConnections()
  }

  return (
    <div className="flex h-full">
      {/* The connections, the open one with its tables (folds away: more room for the data) */}
      <aside aria-label={d.connections} className={cn('flex shrink-0 flex-col border-r border-line-subtle bg-surface transition-[width] duration-200', collapsed ? 'w-14' : 'w-[272px]')}>
        <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center' : 'justify-between pr-2.5 pl-4')}>
          {!collapsed && <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{d.connections}</h2>}
          <span className="flex items-center gap-0.5">
            {!collapsed && <IconButton title={d.detectTitle} onClick={() => setDetect({})}><Search size={14} /></IconButton>}
            {!collapsed && <IconButton title={d.newTitle} onClick={() => setForm({})}><Plus size={15} /></IconButton>}
            <IconButton title={collapsed ? d.showPanel : d.hidePanel} onClick={() => setCollapsed(c => !c)}>
              {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </IconButton>
          </span>
        </div>

        {collapsed ? (
          <div className="flex flex-1 flex-col items-center gap-1 overflow-y-auto py-2">
            {shownConnections.map(c => (
              <button key={c.id} onClick={() => setActive(c.id)} title={`${c.name} (${ENGINE_NAME[c.type]})`} aria-current={active === c.id ? 'true' : undefined}
                className={cn('flex size-10 items-center justify-center rounded-control transition-colors hover:bg-hover', active === c.id && 'bg-accent-soft')}>
                <Database size={16} aria-hidden style={{ color: c.color }} />
                <span className="sr-only">{c.name}</span>
              </button>
            ))}
            <IconButton title={d.newTitle} onClick={() => setForm({})} className="mt-1"><Plus size={15} /></IconButton>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {activeHub?.databases.length ? (
              <button onClick={() => setOnlyActive(v => !v)} aria-pressed={filterOn}
                className={cn('mb-2 ml-1 max-w-full truncate rounded-full border px-2.5 py-0.5 text-xs font-medium', filterOn ? 'border-accent/40 bg-accent-soft text-fg' : 'border-line text-fg-secondary hover:text-fg')}>
                {t.hub.onlyActive.replace('{name}', activeHub.project.name)}
              </button>
            ) : null}
            {connections.length === 0 && <p className="p-4 text-center text-sm text-fg-muted">{d.noConnections}</p>}
            <ul className="flex flex-col gap-0.5">
              {shownConnections.map(c => {
                const open = active === c.id
                return (
                  <li key={c.id}>
                    <div className="group relative">
                      <button onClick={() => setActive(open ? null : c.id)} aria-expanded={open} title={c.type === 'sqlite' ? c.name : `${c.name} · ${c.host ?? ''}${c.sshConnectionId ? ' · SSH' : ''}`}
                        className={cn('flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-base transition-colors hover:bg-hover', open ? 'font-semibold text-fg' : 'text-fg-secondary hover:text-fg')}>
                        <Database size={15} aria-hidden className="shrink-0" style={{ color: c.color }} />
                        <span className="min-w-0 flex-1 truncate">{c.name} <span className="font-normal">({ENGINE_NAME[c.type]})</span></span>
                      </button>
                      <span className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 gap-0.5 rounded-md bg-hover group-focus-within:flex group-hover:flex">
                        <IconButton size="sm" title={d.edit} onClick={() => setForm({ conn: c })}><Pencil size={12} /></IconButton>
                        <IconButton size="sm" tone="danger" title={t.common.delete} onClick={() => remove(c)}><Trash2 size={12} /></IconButton>
                      </span>
                    </div>
                    {/* The open connection's tables, put here by its explorer */}
                    {open && <div ref={setTablesSlot} className="py-1 pl-4" />}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
        {!collapsed && <p className="shrink-0 px-5 pt-2 pb-5 text-xs text-fg-muted">{d.passwordsNote}</p>}
      </aside>

      {/* The explorer of the open connection */}
      {!conn ? (
        <section className="df-mockup flex min-w-0 flex-1 flex-col gap-5 px-8 pt-6.5 pb-8">
          <PageHeader crumb={t.nav.groupData} title={t.nav.database} subtitle={d.subtitle} />
          <EmptyState fill icon={<Database size={32} />} title={d.emptyTitle} description={d.emptyHint}
            action={<>
              <Button onClick={() => setDetect({})}><Search size={14} aria-hidden /> {d.detectTitle}</Button>
              <Button variant="secondary" onClick={() => setForm({})}><Plus size={14} aria-hidden /> {d.newTitle}</Button>
            </>} />
        </section>
      ) : (
        <div className="min-w-0 flex-1">
          <DbExplorer key={`${conn.id}:${rev}`} conn={conn} tablesSlot={collapsed ? undefined : tablesSlot}
            back={from ? { label: d.backToProject.replace('{name}', from.name), onClick: () => navigate(`/project/${from.id}?tab=database`) } : undefined} />
        </div>
      )}

      {detect && (
        <DetectDialog
          initialServer={detect.server}
          onClose={() => { setDetect(null); if (params.has('detect')) setParams({}, { replace: true }) }}
          onAdded={async id => { await reloadConnections(); setActive(id) }}
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
            if (active === c.id) setRev(r => r + 1)
          }}
        />
      )}
    </div>
  )
}
