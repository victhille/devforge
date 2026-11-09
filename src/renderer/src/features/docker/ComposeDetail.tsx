import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LinesSkeleton } from '@renderer/components/ui/Skeleton'
import { Boxes, Container, ExternalLink, Play, RotateCcw, Square, Trash2 } from 'lucide-react'
import type { ComposeAction, ComposeProject, ContainerAction, ContainerStats, DockerContainer } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { pressable } from '@renderer/lib/a11y'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import LogPanel from '@renderer/components/process/LogPanel'
import AskForgy from '@renderer/features/assistant/AskForgy'
import { confirmDialog } from '@renderer/app/ConfirmContext'

/** Compose project and container details: the Docker page and the project page */

/** Host ports published on localhost, e.g. "0.0.0.0:8080->80/tcp" → [8080] */
export function hostPorts(ports: string): number[] {
  return Array.from(new Set([...ports.matchAll(/(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d+)->/g)].map(m => Number(m[1]))))
}

/** "shop-online-backend-1" → "backend" */
export const serviceName = (c: DockerContainer) =>
  c.composeProject ? c.name.replace(new RegExp(`^${c.composeProject}[-_]`), '').replace(/[-_]\d+$/, '') : c.name

/** CPU and memory of the running containers, every 5 s while they are shown */
function useStats(containers: DockerContainer[]): Record<string, ContainerStats> {
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
  return stats
}

/** Live logs of one container or of a whole compose project */
function LogsCard({ title, start, stop }: { title: string; start: () => Promise<string>; stop: () => void }) {
  const { t } = useI18n()
  const [key, setKey] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    start().then(k => { if (alive) setKey(k) }).catch(() => {})
    return () => { alive = false; stop() }
  }, [start, stop])

  return (
    <div className="overflow-hidden rounded-card border border-line-subtle bg-console">
      <div className="flex items-center gap-2.5 border-b border-line-subtle px-4 py-3 text-sm">
        <h3 className="min-w-0 flex-1 truncate font-display font-bold tracking-[-.01em] text-fg">{title}</h3>
        <span className="font-mono text-xs text-fg-muted">{t.docker.live}</span>
        <AskForgy label={t.docker.askForgy} className="h-7 px-2.5 text-xs" />
      </div>
      <div className="[&>div]:max-h-72 [&>div]:rounded-none [&>div]:bg-transparent [&>div]:px-4">
        {key ? <LogPanel procKey={key} /> : <LinesSkeleton lines={4} plain className="p-4" />}
      </div>
    </div>
  )
}

/**
 * The services of a compose project, or the containers on their own: one row
 * each with its ports, CPU, memory and state; a click shows its logs.
 */
function ServicesTable({ containers, busy, onContainer, shownId, onShow, removable }: {
  containers: DockerContainer[]
  busy: Set<string>
  onContainer: (c: DockerContainer, a: ContainerAction) => void
  shownId: string | null
  onShow: (c: DockerContainer) => void
  removable?: boolean
}) {
  const { t, lang } = useI18n()
  const d = t.docker
  const stats = useStats(containers)
  return (
    <Table className="min-w-[640px]">
      <thead>
        <tr>
          <Th className="pl-4.5">{d.colService}</Th>
          <Th>{d.colImage}</Th>
          <Th>{d.colPorts}</Th>
          <Th>{d.colCpu}</Th>
          <Th>{d.colMemory}</Th>
          <Th>{d.colState}</Th>
          <Th align="right"><span className="sr-only">{d.colActions}</span></Th>
        </tr>
      </thead>
      <tbody>
        {containers.map(c => {
          const running = c.state === 'running'
          const st = stats[c.id]
          return (
            <tr key={c.id} onClick={() => onShow(c)} {...pressable(() => onShow(c))} aria-selected={shownId === c.id}
              className={cn('group cursor-pointer', shownId === c.id && '[&>td]:bg-elevated')}>
              <Td className="pl-4.5 font-semibold text-fg">{serviceName(c)}</Td>
              <Td className="max-w-[220px] truncate font-mono text-xs text-fg-secondary" title={c.image}>{c.image}</Td>
              <Td className="font-mono text-xs whitespace-nowrap">
                {hostPorts(c.ports).length === 0 ? <span className="text-fg-muted">—</span> : hostPorts(c.ports).map(port => (
                  <button key={port} onClick={e => { e.stopPropagation(); window.devforge.openExternal(`http://localhost:${port}`) }}
                    title={d.openPort.replace('{port}', String(port))}
                    className="mr-1.5 inline-flex items-center gap-0.5 text-fg hover:text-accent hover:underline">{port}<ExternalLink size={9} aria-hidden /></button>
                ))}
              </Td>
              <Td className="font-mono text-xs whitespace-nowrap text-fg">
                {running ? (st ? `${st.cpu.toLocaleString(lang, { maximumFractionDigits: st.cpu < 10 ? 1 : 0 })} %` : '…') : '—'}
              </Td>
              <Td className="font-mono text-xs whitespace-nowrap text-fg" title={st ? `${st.memoryPct.toFixed(1)} %` : undefined}>{running && st ? st.memory.split('/')[0].trim() : '—'}</Td>
              <Td className="whitespace-nowrap" title={c.status}>
                <Badge dot color={running ? 'success' : 'default'}>{running ? d.stateRunning : d.stateStopped}</Badge>
              </Td>
              <Td align="right" className="whitespace-nowrap" onClick={e => e.stopPropagation()}>
                <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  {busy.has(c.id) ? <Spinner /> : running ? (
                    <>
                      <IconButton size="sm" title={d.restart} onClick={() => onContainer(c, 'restart')}><RotateCcw size={12} /></IconButton>
                      <IconButton size="sm" title={d.stop} onClick={() => onContainer(c, 'stop')}><Square size={11} /></IconButton>
                    </>
                  ) : <IconButton size="sm" title={d.start} onClick={() => onContainer(c, 'start')}><Play size={12} /></IconButton>}
                  {removable && (
                    <IconButton size="sm" tone="danger" title={t.common.delete}
                      onClick={async () => { if ((await confirmDialog(d.removeConfirm.replace('{name}', c.name), { danger: true }))) onContainer(c, 'remove') }}>
                      <Trash2 size={12} />
                    </IconButton>
                  )}
                </div>
              </Td>
            </tr>
          )
        })}
      </tbody>
    </Table>
  )
}

/** The card's head: a tile, the name, where it comes from, its actions */
function DetailHead({ icon, title, sub, where, children }: { icon: ReactNode; title: string; sub?: string; where?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle px-4.5 py-3.5">
      <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-control bg-active text-fg-secondary">{icon}</span>
      <div className="min-w-[160px] flex-1">
        <h2 className="truncate font-display text-lg font-bold tracking-[-.01em] text-fg">{title}</h2>
        {sub && <div className="truncate text-xs text-fg-muted">{sub}</div>}
      </div>
      {where && <span className="max-w-[40%] truncate font-mono text-xs text-fg-muted" title={where}>{where}</span>}
      {children}
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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <DetailHead icon={<Boxes size={16} />} title={p.name} where={p.configFiles || p.dir}
          sub={p.projects?.length ? d.composeProjects.replace('{list}', p.projects.join(', ')) : undefined}>
          {isBusy ? <Spinner /> : (
            <div className="flex flex-wrap items-center gap-2">
              {(p.total === 0 || p.running < p.total) && <Button size="sm" onClick={() => onAction('up')}><Play size={12} aria-hidden /> {d.start}</Button>}
              {p.running > 0 && <Button size="sm" variant="secondary" onClick={() => onAction('restart')}><RotateCcw size={12} aria-hidden /> {d.restart}</Button>}
              {p.running > 0 && <Button size="sm" variant="danger" onClick={() => onAction('stop')}><Square size={11} aria-hidden /> {d.stop}</Button>}
              {p.total > 0 && (
                <IconButton size="sm" title={d.composeDown} tone="danger" onClick={async () => { if ((await confirmDialog(d.composeDownConfirm.replace('{name}', p.name), { danger: true }))) onAction('down') }}>
                  <Trash2 size={13} />
                </IconButton>
              )}
            </div>
          )}
        </DetailHead>
        {containers.length === 0
          ? <p className="px-4.5 py-4 text-sm text-fg-muted">{d.composeNever}{p.services?.length ? ` · ${p.services.join(', ')}` : ''}</p>
          : <ServicesTable containers={containers} busy={busy} onContainer={onContainer} shownId={shown?.id ?? null} onShow={c => setLogsOf(shown?.id === c.id ? null : c)} />}
      </Card>
      {containers.length > 0 && (
        <LogsCard title={d.logsOf.replace('{name}', shown ? serviceName(shown) : d.allServices)} start={startLogs} stop={stopLogs} />
      )}
    </div>
  )
}

/** The containers started on their own (docker run), in one table; a click shows the logs of one */
export function StandaloneDetail({ containers, busy, onContainer }: {
  containers: DockerContainer[]
  busy: Set<string>
  onContainer: (c: DockerContainer, a: ContainerAction) => void
}) {
  const { t } = useI18n()
  const d = t.docker
  const [logsOf, setLogsOf] = useState<string | null>(null)
  const shown = containers.find(c => c.id === logsOf) ?? null
  const startLogs = useCallback(() => window.devforge.docker.followLogs(shown!.id), [shown])
  const stopLogs = useCallback(() => window.devforge.docker.stopLogs(shown!.id), [shown])
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card>
        <DetailHead icon={<Container size={16} />} title={d.standalone} sub={d.standaloneHint} />
        {containers.length === 0 ? <p className="px-4.5 py-4 text-sm text-fg-muted">{d.noContainers}</p>
          : <ServicesTable containers={containers} busy={busy} onContainer={onContainer} shownId={logsOf} onShow={c => setLogsOf(id => (id === c.id ? null : c.id))} removable />}
      </Card>
      {shown && <LogsCard key={shown.id} title={d.logsOf.replace('{name}', shown.name)} start={startLogs} stop={stopLogs} />}
    </div>
  )
}
