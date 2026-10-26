import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Play, RefreshCw, RotateCcw, Square } from 'lucide-react'
import type { RemoteCompose, RemoteContainer, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { pressable } from '@renderer/lib/a11y'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import NeedsSetup from '@renderer/components/NeedsSetup'

const errorText = (err: unknown) => String(err instanceof Error ? err.message : err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** "app-backend-1" in project "app" → "backend" */
const shortName = (c: RemoteContainer) => (c.composeProject ? c.name.replace(new RegExp(`^${c.composeProject}[-_]`), '').replace(/[-_]\d+$/, '') : c.name)

/**
 * Docker on a VPS, over the background watch's SSH session: compose projects,
 * containers with start / stop / restart, and their last log lines.
 */
export default function RemoteDocker({ connections }: { connections: SSHConnection[] }) {
  const { t } = useI18n()
  const d = t.docker
  const w = t.watch
  const toast = useToast()
  const [serverId, setServerId] = useState(connections[0]?.id ?? '')
  const [data, setData] = useState<{ containers: RemoteContainer[]; compose: RemoteCompose[] } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!serverId) return
    setLoading(true)
    setError('')
    try { setData(await window.devforge.watch.docker(serverId)) }
    catch (err) { setError(errorText(err)); setData(null) }
    finally { setLoading(false) }
  }, [serverId])
  useEffect(() => { setSelected(null); setLogs(null); load() }, [load])

  const loadLogs = useCallback(async (name: string) => {
    try { setLogs({ name, text: await window.devforge.watch.dockerLogs(serverId, name, 200) }) }
    catch (err) { setLogs({ name, text: errorText(err) }) }
  }, [serverId])
  // Followed every 5 s while shown
  useEffect(() => {
    if (!logs) return
    const id = setInterval(() => loadLogs(logs.name), 5000)
    return () => clearInterval(id)
  }, [logs, loadLogs])

  const act = async (key: string, target: { container?: string; compose?: RemoteCompose }, action: 'start' | 'stop' | 'restart' | 'up') => {
    setBusy(key)
    try {
      const r = await window.devforge.watch.dockerAction(serverId, target, action)
      if (!r.ok) toast.show({ tone: 'error', title: `${key} — ${d.failed}`, description: r.output.slice(-400) })
      else toast.show({ tone: 'success', title: `${key} · ${action}` })
    } catch (err) { toast.show({ tone: 'error', title: `${key} — ${d.failed}`, description: errorText(err) }) }
    finally { setBusy(null); load() }
  }

  const groups = useMemo(() => {
    const map = new Map<string, RemoteContainer[]>()
    for (const c of data?.containers ?? []) map.set(c.composeProject ?? '', [...(map.get(c.composeProject ?? '') ?? []), c])
    return [...map].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  }, [data])

  if (!connections.length) return <NeedsSetup service="server" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center">
          <span className="sr-only">VPS</span>
          <select value={serverId} onChange={e => setServerId(e.target.value)} className="h-9 rounded-[9px] border border-line bg-canvas px-3 text-sm text-fg outline-none">
            {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.host}</option>)}
          </select>
        </label>
        <Button variant="secondary" onClick={load} loading={loading}>{!loading && <RefreshCw size={14} />} {t.common.refresh}</Button>
      </div>

      {error ? <Card className="p-[18px] text-sm text-danger">{w.vpsNoDocker.replace('{error}', error)}</Card>
        : !data ? <Spinner /> : data.containers.length === 0 ? <EmptyState title={d.noContainers} /> : (
          <div className="flex flex-col gap-4">
            {groups.map(([project, list], gi) => {
              const compose = data.compose.find(c => c.name === project)
              const running = list.filter(c => c.state === 'running').length
              return (
                <Card key={project || '_'} className="df-rise overflow-hidden" style={{ '--i': gi } as CSSProperties}>
                  <div className="flex flex-wrap items-center gap-2.5 border-b border-line-subtle px-[18px] py-3.5">
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold text-fg">{project || d.standalone}</h2>
                      {compose && <div className="truncate font-mono text-[11.5px] text-fg-muted">{compose.configFiles}</div>}
                    </div>
                    <span className="font-mono text-xs text-fg-secondary">{running}/{list.length}</span>
                    {compose && (busy === project ? <Spinner /> : (
                      <>
                        {running < list.length && <Button size="sm" onClick={() => act(project, { compose }, 'up')}><Play size={12} /> {d.start}</Button>}
                        {running > 0 && <Button size="sm" variant="secondary" onClick={() => act(project, { compose }, 'restart')}><RotateCcw size={12} /> {d.restart}</Button>}
                        {running > 0 && <Button size="sm" variant="danger" onClick={() => act(project, { compose }, 'stop')}><Square size={11} /> {d.stop}</Button>}
                      </>
                    ))}
                  </div>
                  {list.map(c => {
                    const on = c.state === 'running'
                    return (
                      <div key={c.id} onClick={() => { setSelected(c.name); loadLogs(c.name) }} {...pressable(() => { setSelected(c.name); loadLogs(c.name) })}
                        className={cn('group flex cursor-pointer items-center gap-3 border-t border-line-subtle px-[18px] py-2.5 first:border-t-0 hover:bg-hover', selected === c.name && 'bg-hover')}>
                        <span className={cn('size-2 shrink-0 rounded-full', on ? 'df-ping bg-success' : 'bg-fg-disabled')} />
                        <span className="w-40 shrink-0 truncate font-medium text-fg">{shortName(c)}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-fg-secondary">{c.image}</span>
                        <span className="hidden w-44 truncate text-right text-xs text-fg-secondary md:block">{c.status}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" onClick={e => e.stopPropagation()}>
                          {busy === c.name ? <Spinner /> : on ? (
                            <>
                              <IconButton size="sm" title={d.restart} onClick={() => act(c.name, { container: c.name }, 'restart')}><RotateCcw size={12} /></IconButton>
                              <IconButton size="sm" title={d.stop} onClick={() => act(c.name, { container: c.name }, 'stop')}><Square size={11} /></IconButton>
                            </>
                          ) : <IconButton size="sm" title={d.start} onClick={() => act(c.name, { container: c.name }, 'start')}><Play size={12} /></IconButton>}
                        </div>
                      </div>
                    )
                  })}
                </Card>
              )
            })}

            {logs && (
              <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-console">
                <div className="flex items-center gap-2.5 border-b border-line-subtle px-4 py-2.5 text-[12.5px]">
                  <b className="font-semibold text-fg">{w.vpsLogs.replace('{name}', logs.name)}</b>
                  <span className="df-ping size-1.5 rounded-full bg-success" />
                  <button onClick={() => loadLogs(logs.name)} className="ml-auto text-xs text-fg-secondary hover:text-fg">{w.refreshLogs}</button>
                </div>
                <pre className="max-h-80 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all text-fg-secondary">{logs.text || '—'}</pre>
              </div>
            )}
          </div>
        )}
    </div>
  )
}
