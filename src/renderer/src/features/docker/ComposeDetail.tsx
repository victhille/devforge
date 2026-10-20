import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import type { ComposeAction, ComposeProject, ContainerAction, ContainerStats, DockerContainer } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { pressable } from '@renderer/lib/a11y'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import LogPanel from '@renderer/components/process/LogPanel'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'

/** Compose project and container details: the Docker page and the project page */

/** Host ports published on localhost, e.g. "0.0.0.0:8080->80/tcp" → [8080] */
export function hostPorts(ports: string): number[] {
  return Array.from(new Set([...ports.matchAll(/(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d+)->/g)].map(m => Number(m[1]))))
}

/** "shop-online-backend-1" → "backend" */
export const serviceName = (c: DockerContainer) =>
  c.composeProject ? c.name.replace(new RegExp(`^${c.composeProject}[-_]`), '').replace(/[-_]\d+$/, '') : c.name

function StatePill({ running }: { running: boolean }) {
  const { t } = useI18n()
  return (
    <span className={cn('rounded-full px-2 py-0.5 font-mono text-[11px] font-medium', running ? 'bg-success-soft text-success' : 'bg-elevated text-fg-muted')}>
      {running ? t.docker.stateRunning : t.docker.stateStopped}
    </span>
  )
}

/** Live logs of one container or of a whole compose project */
function LogsCard({ title, start, stop }: { title: string; start: () => Promise<string>; stop: () => void }) {
  const { t } = useI18n()
  const { setOpen } = useAssistant()
  const [key, setKey] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    start().then(k => { if (alive) setKey(k) }).catch(() => {})
    return () => { alive = false; stop() }
  }, [start, stop])

  return (
    <div className="overflow-hidden rounded-[14px] border border-line-subtle bg-console">
      <div className="flex items-center gap-2.5 border-b border-line-subtle px-4 py-2.5 text-[12.5px]">
        <b className="font-semibold text-fg">{title}</b>
        <span className="df-ping size-1.5 rounded-full bg-success" />
        <span className="text-fg-secondary">{t.docker.live}</span>
        <button onClick={() => setOpen(true)} className="ml-auto h-7 rounded-lg border border-forgy/25 bg-forgy-soft px-2.5 text-xs font-medium text-forgy transition-colors hover:border-forgy/50">
          {t.docker.askForgy}
        </button>
      </div>
      <div className="[&>div]:max-h-72 [&>div]:rounded-none [&>div]:bg-transparent [&>div]:px-4">
        {key ? <LogPanel procKey={key} /> : <div className="p-4"><Spinner /></div>}
      </div>
    </div>
  )
}

export function ComposeDetail({ p, containers, busy, onAction, onContainer }: {
  p: ComposeProject
  containers: DockerContainer[]
  busy: Set<string>
  onAction: (a: ComposeAction) => void
  onContainer: (c: DockerContainer, a: ContainerAction) => void
}) {
  const { t } = useI18n()
  const d = t.docker
  const [logsOf, setLogsOf] = useState<DockerContainer | null>(null)
  const target = useMemo(() => ({ name: p.name, configFiles: p.configFiles, dir: p.dir }), [p.name, p.configFiles, p.dir])

  // Logs: the clicked service, else the whole project
  const shown = logsOf && containers.some(c => c.id === logsOf.id) ? logsOf : null
  const startLogs = useCallback(() => shown ? window.devforge.docker.followLogs(shown.id) : window.devforge.docker.composeLogs(target), [shown, target])
  const stopLogs = useCallback(() => { if (shown) window.devforge.docker.stopLogs(shown.id); else window.devforge.docker.stopComposeLogs(p.name) }, [shown, p.name])
  const isBusy = busy.has(p.name)

  // CPU / memory of the running services, every 5 s while the project is shown
  const runningIds = containers.filter(c => c.state === 'running').map(c => c.id).join(',')
  const [stats, setStats] = useState<Record<string, ContainerStats>>({})
  useEffect(() => {
    if (!runningIds) { setStats({}); return }
    let alive = true
    const load = () => window.devforge.docker.stats(runningIds.split(',')).then(s => { if (alive) setStats(s) }).catch(() => {})
    load()
    const id = setInterval(load, 5000)
    return () => { alive = false; clearInterval(id) }
  }, [runningIds])

  return (
    <>
      <Card className="overflow-hidden rounded-[14px]">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-subtle px-[18px] py-4">
          <div className="min-w-[200px] flex-1">
            <h2 className="text-lg font-semibold text-fg">{p.name}</h2>
            <div className="truncate font-mono text-[11.5px] text-fg-muted">{p.dir ?? p.configFiles}</div>
            {p.projects?.length ? <div className="truncate text-2xs text-fg-muted">{d.composeProjects.replace('{list}', p.projects.join(', '))}</div> : null}
          </div>
          {isBusy ? <Spinner /> : (
            <>
              {(p.total === 0 || p.running < p.total) && <Button size="sm" onClick={() => onAction('up')}><Play size={12} /> {d.start}</Button>}
              {p.running > 0 && <Button size="sm" variant="secondary" onClick={() => onAction('restart')}><RotateCcw size={12} /> {d.restart}</Button>}
              {p.running > 0 && <Button size="sm" variant="danger" onClick={() => onAction('stop')}><Square size={11} /> {d.stop}</Button>}
              {p.total > 0 && (
                <IconButton title={d.composeDown} tone="danger" onClick={() => { if (window.confirm(d.composeDownConfirm.replace('{name}', p.name))) onAction('down') }}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </>
          )}
        </div>
        {containers.length === 0 ? (
          <p className="px-[18px] py-4 text-sm text-fg-muted">{d.composeNever}{p.services?.length ? ` · ${p.services.join(', ')}` : ''}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-base">
              <thead>
                <tr className="text-left font-mono text-[11px] tracking-wider text-fg-muted uppercase">
                  <th className="px-[18px] py-2.5 font-medium">{d.colService}</th>
                  <th className="px-2.5 py-2.5 font-medium">{d.colImage}</th>
                  <th className="px-2.5 py-2.5 font-medium">{d.colPorts}</th>
                  <th className="px-2.5 py-2.5 font-medium">{d.colCpu}</th>
                  <th className="px-2.5 py-2.5 font-medium">{d.colStatus}</th>
                  <th className="px-2.5 py-2.5 font-medium">{d.colState}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {containers.map(c => {
                  const running = c.state === 'running'
                  return (
                    <tr key={c.id} onClick={() => setLogsOf(shown?.id === c.id ? null : c)} {...pressable(() => setLogsOf(shown?.id === c.id ? null : c))} aria-selected={shown?.id === c.id}
                      className={cn('group cursor-pointer border-t border-line-subtle transition-colors hover:bg-hover', shown?.id === c.id && 'bg-hover')}>
                      <td className="px-[18px] py-3 font-medium text-fg">{serviceName(c)}</td>
                      <td className="max-w-[200px] truncate px-2.5 py-3 font-mono text-xs text-fg-secondary">{c.image}</td>
                      <td className="px-2.5 py-3 font-mono text-xs">
                        {hostPorts(c.ports).map(port => (
                          <button key={port} onClick={e => { e.stopPropagation(); window.devforge.openExternal(`http://localhost:${port}`) }}
                            className="mr-1.5 inline-flex items-center gap-0.5 text-accent hover:underline">{port}<ExternalLink size={9} /></button>
                        ))}
                      </td>
                      <td className="px-2.5 py-3 font-mono text-xs text-fg-secondary" title={stats[c.id] ? `${stats[c.id].memory} · ${stats[c.id].memoryPct.toFixed(1)} %` : undefined}>
                        {running ? (stats[c.id] ? `${stats[c.id].cpu < 10 ? stats[c.id].cpu.toFixed(1) : Math.round(stats[c.id].cpu)} %` : '…') : '—'}
                      </td>
                      <td className="px-2.5 py-3 text-xs text-fg-secondary">{c.status}</td>
                      <td className="px-2.5 py-3"><StatePill running={running} /></td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          {busy.has(c.id) ? <Spinner /> : running ? (
                            <>
                              <IconButton size="sm" title={d.restart} onClick={() => onContainer(c, 'restart')}><RotateCcw size={12} /></IconButton>
                              <IconButton size="sm" title={d.stop} onClick={() => onContainer(c, 'stop')}><Square size={11} /></IconButton>
                            </>
                          ) : <IconButton size="sm" title={d.start} onClick={() => onContainer(c, 'start')}><Play size={12} /></IconButton>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {containers.length > 0 && (
        <LogsCard title={d.logsOf.replace('{name}', shown ? serviceName(shown) : d.allServices)} start={startLogs} stop={stopLogs} />
      )}
    </>
  )
}

export function ContainerDetail({ c, busy, onAction }: { c: DockerContainer; busy: boolean; onAction: (a: ContainerAction) => void }) {
  const { t } = useI18n()
  const d = t.docker
  const running = c.state === 'running'
  const startLogs = useCallback(() => window.devforge.docker.followLogs(c.id), [c.id])
  const stopLogs = useCallback(() => window.devforge.docker.stopLogs(c.id), [c.id])
  return (
    <>
      <Card className="flex flex-wrap items-center gap-2.5 rounded-[14px] px-[18px] py-4">
        <div className="min-w-[200px] flex-1">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-fg">{c.name} <StatePill running={running} /></h2>
          <div className="truncate font-mono text-[11.5px] text-fg-muted">{c.image} · {c.id} · {c.status}</div>
        </div>
        {busy ? <Spinner /> : running ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => onAction('restart')}><RotateCcw size={12} /> {d.restart}</Button>
            <Button size="sm" variant="danger" onClick={() => onAction('stop')}><Square size={11} /> {d.stop}</Button>
          </>
        ) : <Button size="sm" onClick={() => onAction('start')}><Play size={12} /> {d.start}</Button>}
        <IconButton title={t.common.delete} tone="danger" onClick={() => { if (window.confirm(d.removeConfirm.replace('{name}', c.name))) onAction('remove') }}>
          <Trash2 size={13} />
        </IconButton>
      </Card>
      <LogsCard title={d.logsOf.replace('{name}', c.name)} start={startLogs} stop={stopLogs} />
    </>
  )
}
