import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Terminal as TerminalIcon, Wifi, WifiOff, Edit2, X, Server, BarChart2, Database, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { SSHConnection, SSHSessionStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { SectionTitle } from '@renderer/components/ui/Page'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import ConnectionForm from './components/ConnectionForm'
import TerminalPane from './components/TerminalPane'
import { pressable } from '@renderer/lib/a11y'

interface ActiveSession {
  sessionId:       string
  connectionId:    string
  connectionName:  string
  connectionColor: string
  status:          SSHSessionStatus['status']
  error?:          string
}

function StatusIcon({ status }: { status: SSHSessionStatus['status'] }) {
  if (status === 'connecting') return <Spinner className="size-2.5" />
  if (status === 'connected')  return <Wifi size={11} className="text-success" />
  return <WifiOff size={11} className="text-fg-muted" />
}

export default function SSHPage() {
  const { t }    = useI18n()
  const navigate = useNavigate()
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [sessions,    setSessions]    = useState<ActiveSession[]>([])
  const [activeId,    setActiveId]    = useState<string | null>(null)
  const [form,        setForm]        = useState<{ open: boolean; target?: SSHConnection }>({ open: false })
  const [panelCollapsed, setPanelCollapsed] = usePersistentState('devforge:ssh-panel-collapsed', false)

  const reload = () => window.devforge.getSshConnections().then(setConnections)

  useEffect(() => { reload() }, [])

  useEffect(() => window.devforge.onSshStatus(status => {
    setSessions(prev => prev.map(s =>
      s.sessionId === status.sessionId ? { ...s, status: status.status, error: status.error } : s
    ))
  }), [])

  async function connect(conn: SSHConnection) {
    // Reuse the live session for this connection if any
    const existing = sessions.find(s => s.connectionId === conn.id && s.status !== 'disconnected')
    if (existing) { setActiveId(existing.sessionId); return }

    const sessionId = await window.devforge.sshConnect(conn.id)
    setSessions(prev => [...prev, {
      sessionId,
      connectionId:    conn.id,
      connectionName:  conn.name,
      connectionColor: conn.color,
      status:          'connecting'
    }])
    setActiveId(sessionId)
  }

  async function closeSession(sessionId: string) {
    await window.devforge.sshDisconnect(sessionId)
    const remaining = sessions.filter(s => s.sessionId !== sessionId)
    setSessions(remaining)
    setActiveId(prev => (prev !== sessionId ? prev : remaining[remaining.length - 1]?.sessionId ?? null))
  }

  async function saveConnection(conn: SSHConnection) {
    await window.devforge.saveSshConnection(conn)
    // Reload from main: the renderer never keeps the password
    await reload()
    setForm({ open: false })
  }

  async function deleteConnection(id: string) {
    await window.devforge.removeSshConnection(id)
    setConnections(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="flex h-full">
      {/* Connections (collapsible: gives the terminal more room) */}
      <aside className={cn('flex shrink-0 flex-col border-r border-line-subtle bg-surface transition-[width] duration-200', panelCollapsed ? 'w-14' : 'w-64')}>
        <div className={cn('flex h-11 shrink-0 items-center border-b border-line-subtle', panelCollapsed ? 'justify-center' : 'justify-between px-3')}>
          {!panelCollapsed && <SectionTitle>{t.ssh.connections}</SectionTitle>}
          <div className="flex items-center gap-0.5">
            {!panelCollapsed && <IconButton title={t.ssh.newConnection} onClick={() => setForm({ open: true })}><Plus size={15} /></IconButton>}
            <IconButton title={panelCollapsed ? t.ssh.showServers : t.ssh.hideServers} onClick={() => setPanelCollapsed(c => !c)}>
              {panelCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </IconButton>
          </div>
        </div>

        <div className={cn('flex-1 overflow-y-auto', panelCollapsed ? 'flex flex-col items-center gap-1 py-2' : 'p-1.5')}>
          {connections.length === 0 && !panelCollapsed && (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-fg-muted">
              <Server size={24} />
              <span>{t.ssh.noConnections}</span>
              <Button variant="secondary" size="sm" onClick={() => setForm({ open: true })}>{t.ssh.addServer}</Button>
            </div>
          )}
          {connections.map(conn => {
            const live = sessions.find(s => s.connectionId === conn.id && s.status !== 'disconnected')
            if (panelCollapsed) {
              return (
                <button
                  key={conn.id}
                  onClick={() => connect(conn)}
                  title={`${conn.name} — ${conn.username}@${conn.host}`}
                  className={cn('relative flex size-10 items-center justify-center rounded-lg font-semibold uppercase transition-colors hover:bg-hover', live && 'bg-hover')}
                  style={{ color: conn.color }}
                >
                  {conn.name.slice(0, 2)}
                  {live && <span className="absolute right-1 bottom-1 size-2 rounded-full bg-success ring-2 ring-surface" />}
                </button>
              )
            }
            return (
              <div key={conn.id} className="group relative rounded-lg transition-colors hover:bg-hover">
                <button onClick={() => connect(conn)} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: conn.color }} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-fg">{conn.name}</span>
                    <span className="truncate font-mono text-2xs text-fg-muted">{conn.username}@{conn.host}:{conn.port}</span>
                  </span>
                  {live && (
                    <span
                      className="rounded-full px-1.5 py-px text-2xs font-semibold uppercase group-hover:invisible"
                      style={{ background: `${conn.color}22`, color: conn.color }}
                    >
                      {live.status === 'connecting' ? '…' : 'live'}
                    </span>
                  )}
                </button>
                <div className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 items-center gap-1 rounded-md bg-hover group-hover:flex">
                  <IconButton size="sm" title="Dashboard" onClick={() => navigate(`/vps/${conn.id}`)}><BarChart2 size={12} /></IconButton>
                  <IconButton size="sm" title={t.ssh.databases} onClick={() => navigate(`/database?detect=${conn.id}`)}><Database size={12} /></IconButton>
                  <IconButton size="sm" title={t.ssh.editConnection} onClick={() => setForm({ open: true, target: conn })}><Edit2 size={12} /></IconButton>
                  <IconButton size="sm" tone="danger" title="Delete" onClick={() => deleteConnection(conn.id)}><Trash2 size={12} /></IconButton>
                </div>
              </div>
            )
          })}
          {panelCollapsed && (
            <IconButton title={t.ssh.newConnection} onClick={() => setForm({ open: true })} className="mt-1"><Plus size={15} /></IconButton>
          )}
        </div>
      </aside>

      {/* Terminals */}
      <div className="flex min-w-0 flex-1 flex-col bg-console">
        {sessions.length === 0 ? (
          <div className="flex flex-1 p-8">
            <EmptyState className="flex-1" icon={<TerminalIcon size={40} />} title={t.ssh.emptyTerminal} />
          </div>
        ) : (
          <>
            <div role="tablist" className="flex h-9 shrink-0 items-end gap-0.5 overflow-x-auto border-b border-line-subtle bg-surface px-1.5">
              {sessions.map(s => (
                <div
                  key={s.sessionId}
                  role="tab"
                  aria-selected={s.sessionId === activeId}
                  onClick={() => setActiveId(s.sessionId)}
                  {...pressable(() => setActiveId(s.sessionId))}
                  className={cn(
                    'flex h-8 cursor-pointer items-center gap-2 rounded-t-md border border-b-0 px-3 text-sm transition-colors',
                    s.sessionId === activeId
                      ? 'border-line-subtle bg-console text-fg'
                      : 'border-transparent text-fg-secondary hover:bg-hover hover:text-fg'
                  )}
                >
                  <span className="size-2 rounded-full" style={{ background: s.connectionColor }} />
                  <span className="whitespace-nowrap">{s.connectionName}</span>
                  <StatusIcon status={s.status} />
                  <IconButton
                    size="sm"
                    title="Close"
                    className="size-5"
                    onClick={e => { e.stopPropagation(); closeSession(s.sessionId) }}
                  >
                    <X size={11} />
                  </IconButton>
                </div>
              ))}
            </div>

            {/* All panes stay mounted, only the active one is visible */}
            <div className="relative flex-1">
              {sessions.map(s => (
                <TerminalPane key={s.sessionId} sessionId={s.sessionId} status={s.status} error={s.error} active={s.sessionId === activeId} />
              ))}
            </div>
          </>
        )}
      </div>

      {form.open && (
        <ConnectionForm initial={form.target} onSave={saveConnection} onCancel={() => setForm({ open: false })} />
      )}
    </div>
  )
}
