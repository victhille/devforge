import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Database, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import type { DbConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import { useActiveHub } from '@renderer/hooks/useActiveHub'
import { SectionTitle } from '@renderer/components/ui/Page'
import DbConnectionForm from './DbConnectionForm'
import DetectDialog from './DetectDialog'
import DbExplorer from './DbExplorer'

export default function DatabasePage() {
  const { t } = useI18n()
  const d = t.database
  const [connections, setConnections] = useState<DbConnection[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [collapsed, setCollapsed] = usePersistentState('devforge:db-panel-collapsed', false)
  const [form, setForm] = useState<{ conn?: DbConnection } | null>(null)
  /** Bumped when the open connection is edited: its explorer starts again */
  const [rev, setRev] = useState(0)
  const [params, setParams] = useSearchParams()
  const [detect, setDetect] = useState<{ server?: string } | null>(() => (params.get('detect') ? { server: params.get('detect')! } : null))

  const reloadConnections = useCallback(() => window.devforge.db.list().then(setConnections), [])
  useEffect(() => { reloadConnections() }, [reloadConnections])
  // ?conn=<id>: opened from a project page
  const wantedConn = useRef(params.get('conn'))
  useEffect(() => {
    const id = wantedConn.current
    if (id && connections.some(c => c.id === id)) { wantedConn.current = null; select(id) }
  }, [connections])

  const conn = connections.find(c => c.id === active)

  function select(id: string) {
    setActive(id)
  }

  // ?from=<project id>: "← Back to the project", on its Database tab
  const navigate = useNavigate()
  const [from, setFrom] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    const id = params.get('from')
    if (!id) return
    window.devforge.getProjects().then(list => { const p = list.find(x => x.id === id); if (p) setFrom({ id: p.id, name: p.name }) }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Active project only (its linked databases)
  const activeHub = useActiveHub()
  const [onlyActive, setOnlyActive] = usePersistentState('devforge:db-only-active', false)
  const filterOn = onlyActive && !!activeHub?.databases.length
  const shownConnections = filterOn ? connections.filter(c => activeHub!.databases.some(d => d.id === c.id)) : connections

  return (
    <div className="flex h-full">
      {/* Connections (collapsible: more room for the data) */}
      <aside className={cn('flex shrink-0 flex-col border-r border-line-subtle bg-sidebar transition-[width] duration-200', collapsed ? 'w-14' : 'w-[260px]')}>
        <div className={cn('flex h-11 shrink-0 items-center border-b border-line-subtle', collapsed ? 'justify-center' : 'justify-between px-3')}>
          {!collapsed && (activeHub?.databases.length
            ? <button onClick={() => setOnlyActive(v => !v)} aria-pressed={filterOn}
                className={cn('truncate rounded-full border px-2.5 py-0.5 text-xs font-medium', filterOn ? 'border-accent/40 bg-active text-fg' : 'border-line text-fg-secondary hover:text-fg')}>
                {filterOn ? t.hub.onlyActive.replace('{name}', activeHub.project.name) : d.connections}
              </button>
            : <SectionTitle>{d.connections}</SectionTitle>)}
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
            {shownConnections.map(c => (
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
            {shownConnections.map(c => (
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

              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Explorer of the chosen connection */}
      {!conn ? (
        <section className="flex min-w-0 flex-1 p-8">
          <EmptyState className="flex-1" icon={<Database size={32} />} title={d.emptyTitle} description={d.emptyHint}
            action={
              <div className="flex gap-2">
                <Button onClick={() => setDetect({})}><Search size={14} /> {d.detectTitle}</Button>
                <Button variant="secondary" onClick={() => setForm({})}><Plus size={14} /> {d.newTitle}</Button>
              </div>
            } />
        </section>
      ) : (
        <div className="min-w-0 flex-1">
          <DbExplorer key={`${conn.id}:${rev}`} conn={conn}
            back={from ? { label: d.backToProject.replace('{name}', from.name), onClick: () => navigate(`/project/${from.id}?tab=database`) } : undefined} />
        </div>
      )}

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
            if (active === c.id) setRev(r => r + 1)
          }}
        />
      )}
    </div>
  )
}
