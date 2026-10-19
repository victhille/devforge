import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Container, Eraser, ExternalLink, Layers, Play, RefreshCw, RotateCcw, Square, Trash2 } from 'lucide-react'
import type { ComposeAction, ComposeProject, ContainerAction, DockerContainer, DockerOverview } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Page } from '@renderer/components/ui/Page'
import LogPanel from '@renderer/components/process/LogPanel'
import { useAssistant, useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'

/** What the right side shows */
type Selection = { kind: 'compose'; name: string } | { kind: 'container'; id: string } | { kind: 'images' }

/** Host ports published on localhost, e.g. "0.0.0.0:8080->80/tcp" → [8080] */
function hostPorts(ports: string): number[] {
  return Array.from(new Set([...ports.matchAll(/(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d+)->/g)].map(m => Number(m[1]))))
}

/** "shop-online-backend-1" → "backend" */
const serviceName = (c: DockerContainer) =>
  c.composeProject ? c.name.replace(new RegExp(`^${c.composeProject}[-_]`), '').replace(/[-_]\d+$/, '') : c.name

function NavItem({ active, live, label, meta, onClick }: { active: boolean; live: boolean | null; label: string; meta: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 rounded-xl border p-3 text-left text-base font-medium transition-colors',
        active ? 'border-accent/40 bg-active text-fg' : 'border-line-subtle bg-surface text-fg-secondary hover:bg-hover hover:text-fg'
      )}
    >
      <span className={cn('size-2 shrink-0 rounded-full', live === null ? 'border border-fg-muted' : live ? 'df-ping bg-success' : 'bg-fg-disabled')} />
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-2xs text-fg-muted">{meta}</span>
    </button>
  )
}

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

function ComposeDetail({ p, containers, busy, onAction, onContainer }: {
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
                  <th className="px-2.5 py-2.5 font-medium">{d.colStatus}</th>
                  <th className="px-2.5 py-2.5 font-medium">{d.colState}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {containers.map(c => {
                  const running = c.state === 'running'
                  return (
                    <tr key={c.id} onClick={() => setLogsOf(shown?.id === c.id ? null : c)}
                      className={cn('group cursor-pointer border-t border-line-subtle transition-colors hover:bg-hover', shown?.id === c.id && 'bg-hover')}>
                      <td className="px-[18px] py-3 font-medium text-fg">{serviceName(c)}</td>
                      <td className="max-w-[200px] truncate px-2.5 py-3 font-mono text-xs text-fg-secondary">{c.image}</td>
                      <td className="px-2.5 py-3 font-mono text-xs">
                        {hostPorts(c.ports).map(port => (
                          <button key={port} onClick={e => { e.stopPropagation(); window.devforge.openExternal(`http://localhost:${port}`) }}
                            className="mr-1.5 inline-flex items-center gap-0.5 text-accent hover:underline">{port}<ExternalLink size={9} /></button>
                        ))}
                      </td>
                      <td className="px-2.5 py-3 text-xs text-fg-secondary">{c.status}</td>
                      <td className="px-2.5 py-3"><StatePill running={running} /></td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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

function ContainerDetail({ c, busy, onAction }: { c: DockerContainer; busy: boolean; onAction: (a: ContainerAction) => void }) {
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

export default function DockerPage() {
  const { t } = useI18n()
  const d = t.docker
  const toast = useToast()
  const [data, setData] = useState<DockerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [pruning, setPruning] = useState<'confirm' | 'running' | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const o = await window.devforge.docker.overview()
      setData(o)
      return o
    } finally { setLoading(false) }
  }, [])

  // Opens on the project that runs, else the first one
  useEffect(() => {
    reload().then(o => {
      if (!o.available) return
      const first = [...o.compose].sort((a, b) => b.running - a.running)[0]
      setSelection(s => s ?? (first ? { kind: 'compose', name: first.name } : o.containers[0] ? { kind: 'container', id: o.containers[0].id } : { kind: 'images' }))
    })
  }, [reload])

  async function withBusy(id: string, fn: () => Promise<{ ok: boolean; output: string }>, label: string, success?: string) {
    setBusy(prev => new Set(prev).add(id))
    try {
      const r = await fn()
      if (!r.ok) toast.show({ tone: 'error', title: `${label} — ${d.failed}`, description: r.output.split('\n').slice(-6).join('\n') })
      else if (success) toast.show({ tone: 'success', title: success })
      await reload()
    } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  async function doPrune() {
    setPruning('running')
    const r = await window.devforge.docker.prune()
    setPruning(null)
    toast.show(r.ok ? { tone: 'success', title: d.pruned, description: r.output.split('\n').pop() } : { tone: 'error', title: d.failed, description: r.output })
    reload()
  }

  const compose = useMemo(() => [...(data?.compose ?? [])].sort((a, b) => b.running - a.running || a.name.localeCompare(b.name)), [data])
  const standalone = useMemo(() => (data?.containers ?? []).filter(c => !c.composeProject), [data])
  const running = data?.containers.filter(c => c.state === 'running').length ?? 0

  useAssistantPageContext(data?.available ? {
    label: `Docker — ${running} / ${data.containers.length}`,
    content: [
      'Containers:',
      ...data.containers.map(c => `${c.name} [${c.state}] ${c.image} ${c.status} ${c.ports}${c.composeProject ? ` (compose ${c.composeProject})` : ''}`),
      'Compose projects:',
      ...data.compose.map(p => `${p.name}: ${p.running}/${p.total} running${p.services?.length ? `, services ${p.services.join(', ')}` : ''}${p.dir ? ` — ${p.dir}` : ''}`)
    ].join('\n')
  } : null)

  const selectedCompose = selection?.kind === 'compose' ? compose.find(p => p.name === selection.name) : undefined
  const selectedContainer = selection?.kind === 'container' ? data?.containers.find(c => c.id === selection.id) : undefined

  return (
    <Page className="max-w-[1280px] gap-5 px-8 pt-7">
      <header className="df-rise flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-.02em] text-fg">{d.title}</h1>
          <p className="text-sm text-fg-muted">{data?.available ? d.subtitle.replace('{v}', data.version ?? '').replace('{n}', String(running)) : d.subtitleOff}</p>
        </div>
        <Button variant="secondary" onClick={reload} loading={loading}>{!loading && <RefreshCw size={14} />} {t.common.refresh}</Button>
        <Button variant="secondary" onClick={() => setPruning('confirm')} disabled={!data?.available}><Eraser size={14} /> {d.prune}</Button>
      </header>

      {data && !data.available ? (
        <EmptyState icon={<Container size={32} />} title={d.unavailable} description={data.error} />
      ) : !data ? <Spinner /> : (
        <div className="flex flex-wrap items-start gap-4">
          <nav aria-label="Docker" className="df-rise flex max-w-[260px] flex-[1_1_220px] flex-col gap-2" style={{ '--i': 1 } as CSSProperties}>
            <span className="px-1 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{d.navCompose}</span>
            {compose.length === 0 && <span className="px-1 text-sm text-fg-muted">{d.noCompose}</span>}
            {compose.map(p => (
              <NavItem key={p.name} label={p.name} meta={`${p.running}/${p.total}`} live={p.total === 0 ? null : p.running > 0}
                active={selection?.kind === 'compose' && selection.name === p.name} onClick={() => setSelection({ kind: 'compose', name: p.name })} />
            ))}
            {standalone.length > 0 && <span className="px-1 pt-2.5 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{d.navStandalone}</span>}
            {standalone.map(c => (
              <NavItem key={c.id} label={c.name} meta={hostPorts(c.ports).map(p => `:${p}`).join(' ')} live={c.state === 'running'}
                active={selection?.kind === 'container' && selection.id === c.id} onClick={() => setSelection({ kind: 'container', id: c.id })} />
            ))}
            <span className="px-1 pt-2.5 font-mono text-2xs font-medium tracking-widest text-fg-muted uppercase">{d.images}</span>
            <NavItem label={d.images} meta={String(data.images.length)} live={null}
              active={selection?.kind === 'images'} onClick={() => setSelection({ kind: 'images' })} />
          </nav>

          <section className="df-rise flex min-w-0 flex-[999_1_480px] flex-col gap-4" style={{ '--i': 2 } as CSSProperties}>
            {selectedCompose && (
              <ComposeDetail
                key={selectedCompose.name}
                p={selectedCompose}
                containers={data.containers.filter(c => c.composeProject === selectedCompose.name)}
                busy={busy}
                onAction={a => withBusy(selectedCompose.name, () => window.devforge.docker.compose({ name: selectedCompose.name, configFiles: selectedCompose.configFiles, dir: selectedCompose.dir }, a), selectedCompose.name,
                  a === 'up' ? d.composeStarted.replace('{name}', selectedCompose.name) : undefined)}
                onContainer={(c, a) => withBusy(c.id, () => window.devforge.docker.container(c.id, a), c.name)}
              />
            )}
            {selectedContainer && (
              <ContainerDetail key={selectedContainer.id} c={selectedContainer} busy={busy.has(selectedContainer.id)}
                onAction={a => withBusy(selectedContainer.id, () => window.devforge.docker.container(selectedContainer.id, a), selectedContainer.name)} />
            )}
            {selection?.kind === 'images' && (
              <Card className="divide-y divide-line-subtle rounded-[14px]">
                {data.images.map(img => (
                  <div key={img.id + img.tag} className="flex items-center gap-4 px-[18px] py-3">
                    <Layers size={14} className="shrink-0 text-fg-muted" />
                    <span className="flex-1 truncate font-mono text-sm text-fg">{img.repository}<span className="text-fg-muted">:{img.tag}</span></span>
                    <span className="font-mono text-2xs text-fg-muted">{img.id}</span>
                    <span className="w-28 text-right text-xs text-fg-secondary">{img.createdSince}</span>
                    <span className="w-20 rounded-md bg-elevated px-2 py-0.5 text-center font-mono text-xs text-fg-secondary">{img.size}</span>
                  </div>
                ))}
              </Card>
            )}
            {!selectedCompose && !selectedContainer && selection?.kind !== 'images' && <EmptyState title={d.noContainers} />}
          </section>
        </div>
      )}

      {pruning && (
        <Modal
          title={d.pruneTitle}
          onClose={() => pruning !== 'running' && setPruning(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPruning(null)} disabled={pruning === 'running'}>{t.common.cancel}</Button>
              <Button variant="danger" loading={pruning === 'running'} onClick={doPrune}>{d.prune}</Button>
            </>
          }
        >
          <p className="text-fg-secondary">{d.pruneText}</p>
        </Modal>
      )}
    </Page>
  )
}
