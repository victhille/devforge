import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, ChevronDown, ChevronRight, Container, ExternalLink, Layers, Play, RefreshCw, RotateCcw, Square, Trash2, Eraser } from 'lucide-react'
import type { ComposeAction, ComposeProject, ContainerAction, DockerContainer, DockerOverview } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'
import LogPanel from '@renderer/components/process/LogPanel'

type Tab = 'containers' | 'images' | 'compose'

const STATE_DOT: Record<string, string> = {
  running: 'bg-success', exited: 'bg-fg-muted', paused: 'bg-warning', restarting: 'bg-warning animate-pulse', created: 'bg-accent', dead: 'bg-danger'
}

/** Host ports published on localhost, e.g. "0.0.0.0:8080->80/tcp" → [8080] */
function hostPorts(ports: string): number[] {
  return Array.from(new Set([...ports.matchAll(/(?:0\.0\.0\.0|\[::\]|127\.0\.0\.1):(\d+)->/g)].map(m => Number(m[1]))))
}

function ContainerRow({ c, onAction, busy }: { c: DockerContainer; onAction: (a: ContainerAction) => void; busy: boolean }) {
  const { t } = useI18n()
  const d = t.docker
  const [logs, setLogs] = useState<string | null>(null)
  const running = c.state === 'running'

  async function toggleLogs() {
    if (logs) { window.devforge.docker.stopLogs(c.id); setLogs(null) }
    else setLogs(await window.devforge.docker.followLogs(c.id))
  }

  // Stop following when the row unmounts
  useEffect(() => () => { if (logs) window.devforge.docker.stopLogs(c.id) }, [logs, c.id])

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-3">
        <button onClick={toggleLogs} className="text-fg-muted hover:text-fg" aria-label={d.logs}>
          {logs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className={cn('size-2 shrink-0 rounded-full', STATE_DOT[c.state] ?? 'bg-fg-muted')} title={c.state} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-fg">{c.name}</span>
          <span className="truncate font-mono text-2xs text-fg-muted">{c.image} · {c.id}</span>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {hostPorts(c.ports).map(p => (
            <button key={p} onClick={() => window.devforge.openExternal(`http://localhost:${p}`)}
              className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-px font-mono text-2xs text-accent hover:underline">
              :{p} <ExternalLink size={9} />
            </button>
          ))}
        </div>
        <span className="w-40 shrink-0 truncate text-right text-xs text-fg-secondary">{c.status}</span>
        <div className="flex shrink-0 items-center gap-1">
          {busy ? <Spinner className="mx-2" /> : running ? (
            <>
              <IconButton title={d.restart} onClick={() => onAction('restart')}><RotateCcw size={13} /></IconButton>
              <IconButton title={d.stop} onClick={() => onAction('stop')}><Square size={12} /></IconButton>
            </>
          ) : (
            <IconButton title={d.start} onClick={() => onAction('start')}><Play size={13} /></IconButton>
          )}
          <IconButton title={t.common.delete} tone="danger" onClick={() => { if (window.confirm(d.removeConfirm.replace('{name}', c.name))) onAction('remove') }}>
            <Trash2 size={13} />
          </IconButton>
        </div>
      </div>
      {logs && <div className="mt-2.5"><LogPanel procKey={logs} /></div>}
    </div>
  )
}

function ComposeRow({ p, busy, onAction }: { p: ComposeProject; busy: boolean; onAction: (a: ComposeAction) => void }) {
  const { t } = useI18n()
  const d = t.docker
  const [logs, setLogs] = useState<string | null>(null)
  const target = { name: p.name, configFiles: p.configFiles, dir: p.dir }

  async function toggleLogs() {
    if (logs) { window.devforge.docker.stopComposeLogs(p.name); setLogs(null) }
    else setLogs(await window.devforge.docker.composeLogs(target))
  }
  useEffect(() => () => { if (logs) window.devforge.docker.stopComposeLogs(p.name) }, [logs, p.name])

  const state = p.total === 0 ? d.composeNever : d.composeRunning.replace('{n}', String(p.running)).replace('{total}', String(p.total))
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button onClick={toggleLogs} className="text-fg-muted hover:text-fg disabled:opacity-40" aria-label={d.logs} disabled={p.total === 0}>
          {logs ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <span className={cn('size-2 shrink-0 rounded-full', p.running > 0 ? 'bg-success' : p.total > 0 ? 'bg-fg-muted' : 'border border-fg-muted')} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2 font-medium text-fg">
            {p.name}
            {p.services?.map(name => <Badge key={name}>{name}</Badge>)}
          </span>
          <span className="truncate font-mono text-2xs text-fg-muted">{p.dir ?? p.configFiles}</span>
          {p.projects?.length ? (
            <span className="truncate text-2xs text-fg-muted">{d.composeProjects.replace('{list}', p.projects.join(', '))}</span>
          ) : null}
        </div>
        <span className="shrink-0 text-xs text-fg-secondary">{state}</span>
        {busy ? <Spinner className="mx-2" /> : (
          <div className="flex shrink-0 gap-2">
            {(p.total === 0 || p.running < p.total) && (
              <Button size="sm" onClick={() => onAction('up')}><Play size={12} /> {d.start}</Button>
            )}
            {p.running > 0 && (
              <>
                <Button size="sm" variant="secondary" onClick={() => onAction('restart')}><RotateCcw size={12} /> {d.restart}</Button>
                <Button size="sm" variant="secondary" onClick={() => onAction('stop')}><Square size={11} /> {d.stop}</Button>
              </>
            )}
            {p.total > 0 && (
              <IconButton title={d.composeDown} tone="danger"
                onClick={() => { if (window.confirm(d.composeDownConfirm.replace('{name}', p.name))) onAction('down') }}>
                <Trash2 size={13} />
              </IconButton>
            )}
          </div>
        )}
      </div>
      {logs && <div className="mt-2.5"><LogPanel procKey={logs} /></div>}
    </div>
  )
}

export default function DockerPage() {
  const { t } = useI18n()
  const d = t.docker
  const toast = useToast()
  const [data, setData] = useState<DockerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('containers')
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

  // Nothing running yet: open on the projects that can be started
  useEffect(() => { reload().then(o => { if (o.available && o.containers.length === 0 && o.compose.length) setTab('compose') }) }, [reload])

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

  // Containers grouped by compose project (standalone ones last)
  const groups = useMemo(() => {
    const map = new Map<string, DockerContainer[]>()
    for (const c of data?.containers ?? []) {
      const key = c.composeProject ?? ''
      map.set(key, [...(map.get(key) ?? []), c])
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  }, [data])

  const running = data?.containers.filter(c => c.state === 'running').length ?? 0

  return (
    <Page>
      <PageHeader
        icon={<Container size={18} />}
        title={d.title}
        subtitle={data?.available ? d.subtitle.replace('{v}', data.version ?? '').replace('{n}', String(running)) : d.subtitleOff}
        actions={
          <>
            <Button variant="secondary" onClick={reload} loading={loading}>{!loading && <RefreshCw size={14} />} {t.common.refresh}</Button>
            <Button variant="danger" onClick={() => setPruning('confirm')} disabled={!data?.available}><Eraser size={14} /> {d.prune}</Button>
          </>
        }
      />

      {data && !data.available ? (
        <EmptyState icon={<Container size={32} />} title={d.unavailable} description={data.error} />
      ) : data && (
        <>
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            items={[
              { value: 'containers', label: `${d.containers} (${data.containers.length})`, icon: <Box size={13} /> },
              { value: 'images',     label: `${d.images} (${data.images.length})`,         icon: <Layers size={13} /> },
              { value: 'compose',    label: `Compose (${data.compose.length})`,             icon: <Container size={13} /> }
            ]}
          />

          {tab === 'containers' && (data.containers.length === 0 ? <EmptyState title={d.noContainers} /> : groups.map(([project, list]) => (
            <section key={project || '_'} className="flex flex-col gap-2">
              <SectionTitle>{project || d.standalone}</SectionTitle>
              <Card className="divide-y divide-line-subtle">
                {list.map(c => (
                  <ContainerRow key={c.id} c={c} busy={busy.has(c.id)}
                    onAction={a => withBusy(c.id, () => window.devforge.docker.container(c.id, a), c.name)} />
                ))}
              </Card>
            </section>
          )))}

          {tab === 'images' && (
            <Card className="divide-y divide-line-subtle">
              {data.images.map(img => (
                <div key={img.id + img.tag} className="flex items-center gap-4 px-4 py-2.5">
                  <Layers size={14} className="shrink-0 text-fg-muted" />
                  <span className="flex-1 truncate font-mono text-sm text-fg">{img.repository}<span className="text-fg-muted">:{img.tag}</span></span>
                  <span className="font-mono text-2xs text-fg-muted">{img.id}</span>
                  <span className="w-28 text-right text-xs text-fg-secondary">{img.createdSince}</span>
                  <Badge className="w-20 justify-center font-mono">{img.size}</Badge>
                </div>
              ))}
            </Card>
          )}

          {tab === 'compose' && (data.compose.length === 0 ? <EmptyState title={d.noCompose} /> : (
            <Card className="divide-y divide-line-subtle">
              {data.compose.map(p => (
                <ComposeRow key={p.name} p={p} busy={busy.has(p.name)}
                  onAction={a => withBusy(p.name, () => window.devforge.docker.compose({ name: p.name, configFiles: p.configFiles, dir: p.dir }, a), p.name,
                    a === 'up' ? d.composeStarted.replace('{name}', p.name) : undefined)} />
              ))}
            </Card>
          ))}
        </>
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
