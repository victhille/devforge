import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Boxes, Container, Play, RefreshCw, RotateCcw, Square } from 'lucide-react'
import type { RemoteCompose, RemoteContainer, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { pressable } from '@renderer/lib/a11y'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { errorText } from '@renderer/lib/errors'
import LogBox from '@renderer/components/ui/LogBox'

/** "app-backend-1" in project "app" → "backend" */
const shortName = (c: RemoteContainer) => (c.composeProject ? c.name.replace(new RegExp(`^${c.composeProject}[-_]`), '').replace(/[-_]\d+$/, '') : c.name)

/**
 * Docker on a VPS, over the background watch's SSH session: compose projects,
 * containers with start / stop / restart, and their last log lines. The server
 * comes from the page's tab; with many servers, a picker here.
 */
export default function RemoteDocker({ connections, connectionId }: { connections: SSHConnection[]; connectionId?: string }) {
  const { t } = useI18n()
  const d = t.docker
  const w = t.watch
  const toast = useToast()
  const [picked, setPicked] = useState(connections[0]?.id ?? '')
  const serverId = connectionId ?? picked
  const [data, setData] = useState<{ containers: RemoteContainer[]; compose: RemoteCompose[] } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!serverId) return
    setLoading(true)
    setError('')
    try { setData(await window.devforge.watch.docker(serverId)) }
    catch (err) { setError(errorText(err)); setData(null) }
    finally { setLoading(false) }
  }, [serverId])
  useEffect(() => { setLogs(null); load() }, [load])

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

  const showLogs = (name: string) => (logs?.name === name ? setLogs(null) : loadLogs(name))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {!connectionId && (
          <label className="flex items-center">
            <span className="sr-only">{d.server}</span>
            <select value={picked} onChange={e => setPicked(e.target.value)} className="h-9 rounded-control border border-line bg-canvas px-3 text-sm text-fg outline-none">
              {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.host}</option>)}
            </select>
          </label>
        )}
        <Button variant="secondary" onClick={load} loading={loading}>{!loading && <RefreshCw size={14} aria-hidden />} {t.common.refresh}</Button>
      </div>

      {error ? <Card className="p-4.5 text-sm text-danger">{w.vpsNoDocker.replace('{error}', error)}</Card>
        : !data ? <Spinner /> : data.containers.length === 0 ? <EmptyState title={d.noContainers} /> : (
          <div className="flex flex-col gap-4">
            {groups.map(([project, list], gi) => {
              const compose = data.compose.find(c => c.name === project)
              const running = list.filter(c => c.state === 'running').length
              return (
                <Card key={project || '_'} className="df-rise" style={{ '--i': gi } as CSSProperties}>
                  <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle px-4.5 py-3.5">
                    <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control bg-active text-fg-secondary">
                      {project ? <Boxes size={16} /> : <Container size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-lg font-bold tracking-[-.01em] text-fg">{project || d.standalone}</h2>
                      {compose && <div className="truncate font-mono text-xs text-fg-muted">{compose.configFiles}</div>}
                    </div>
                    <span className="font-mono text-xs text-fg-secondary">{running}/{list.length}</span>
                    {compose && (busy === project ? <Spinner /> : (
                      <>
                        {running < list.length && <Button size="sm" onClick={() => act(project, { compose }, 'up')}><Play size={12} aria-hidden /> {d.start}</Button>}
                        {running > 0 && <Button size="sm" variant="secondary" onClick={() => act(project, { compose }, 'restart')}><RotateCcw size={12} aria-hidden /> {d.restart}</Button>}
                        {running > 0 && <Button size="sm" variant="danger" onClick={() => act(project, { compose }, 'stop')}><Square size={11} aria-hidden /> {d.stop}</Button>}
                      </>
                    ))}
                  </div>
                  {/* Same widths in every card: the columns line up from one project to the next */}
                  <Table className="min-w-[640px] table-fixed">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[34%]" />
                      <col className="w-[20%]" />
                      <col className="w-[13%]" />
                      <col className="w-[11%]" />
                    </colgroup>
                    <thead>
                      <tr>
                        <Th className="pl-4.5">{d.colService}</Th>
                        <Th>{d.colImage}</Th>
                        <Th>{d.colStatus}</Th>
                        <Th>{d.colState}</Th>
                        <Th align="right"><span className="sr-only">{d.colActions}</span></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map(c => {
                        const on = c.state === 'running'
                        return (
                          <tr key={c.id} onClick={() => showLogs(c.name)} {...pressable(() => showLogs(c.name))} aria-selected={logs?.name === c.name}
                            className={cn('group cursor-pointer', logs?.name === c.name && '[&>td]:bg-elevated')}>
                            <Td className="truncate pl-4.5 font-semibold text-fg" title={c.name}>{shortName(c)}</Td>
                            <Td className="truncate font-mono text-xs text-fg-secondary" title={c.image}>{c.image}</Td>
                            <Td className="truncate text-xs text-fg-secondary" title={c.status}>{c.status}</Td>
                            <Td className="whitespace-nowrap"><Badge dot color={on ? 'success' : 'default'}>{on ? d.stateRunning : d.stateStopped}</Badge></Td>
                            <Td align="right" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                                {busy === c.name ? <Spinner /> : on ? (
                                  <>
                                    <IconButton size="sm" title={d.restart} onClick={() => act(c.name, { container: c.name }, 'restart')}><RotateCcw size={12} /></IconButton>
                                    <IconButton size="sm" title={d.stop} onClick={() => act(c.name, { container: c.name }, 'stop')}><Square size={11} /></IconButton>
                                  </>
                                ) : <IconButton size="sm" title={d.start} onClick={() => act(c.name, { container: c.name }, 'start')}><Play size={12} /></IconButton>}
                              </div>
                            </Td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </Table>
                </Card>
              )
            })}

            {logs && (
              <LogBox text={logs.text} placeholder="—"
                title={<span className="flex items-center gap-2.5">{w.vpsLogs.replace('{name}', logs.name)} <span className="font-mono text-xs font-normal text-fg-muted">{d.live}</span></span>}
                label={w.vpsLogs.replace('{name}', logs.name)}
                actions={<Button size="sm" variant="ghost" onClick={() => loadLogs(logs.name)}>{w.refreshLogs}</Button>} />
            )}
          </div>
        )}
    </div>
  )
}
