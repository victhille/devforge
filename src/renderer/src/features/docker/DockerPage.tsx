import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Container, Eraser, RefreshCw } from 'lucide-react'
import type { DockerOverview, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import { ComposeDetail, StandaloneDetail } from './ComposeDetail'
import RemoteDocker from './RemoteDocker'
import Tabs from '@renderer/components/ui/Tabs'
import { useActiveHub } from '@renderer/hooks/useActiveHub'
import { usePersistentState } from '@renderer/hooks/usePersistentState'

/** What the right side shows */
type Selection = { kind: 'compose'; name: string } | { kind: 'standalone' } | { kind: 'images' }

/** Up to this many servers, each has its tab beside « This PC »; more share one tab and a picker */
const TABBED_SERVERS = 3

/** A line of the left menu: a dot when it runs, its name, a count */
function NavItem({ active, live, label, meta, onClick }: { active: boolean; live: boolean | null; label: string; meta: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-10 items-center gap-2.5 rounded-control px-3 text-left text-base transition-colors',
        active ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg'
      )}
    >
      {live !== null && <span aria-hidden className={cn('size-2 shrink-0 rounded-full', live ? 'bg-success' : 'bg-fg-disabled')} />}
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-xs text-fg-muted">{meta}</span>
    </button>
  )
}

const NavTitle = ({ children }: { children: string }) => (
  <span className="col-span-full px-1 pt-1 text-xs font-semibold tracking-wider text-fg-muted uppercase">{children}</span>
)

const FilterChip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button onClick={onClick} aria-pressed={on}
    className={cn('h-9 rounded-full border px-3.5 text-sm font-medium transition-colors', on ? 'border-accent/40 bg-accent-soft text-fg' : 'border-line bg-surface text-fg-secondary hover:text-fg')}>
    {label}
  </button>
)

export default function DockerPage() {
  const { t, lang } = useI18n()
  const d = t.docker
  const toast = useToast()
  const [data, setData] = useState<DockerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [pruning, setPruning] = useState<'confirm' | 'running' | null>(null)
  // This PC, or a server through SSH ('vps': the picker of the servers when there are many)
  const [where, setWhere] = usePersistentState<string>('devforge:docker-where', 'local')
  const [servers, setServers] = useState<SSHConnection[]>([])
  useEffect(() => { window.devforge.getSshConnections().then(setServers).catch(() => {}) }, [])
  const tabbed = servers.length <= TABBED_SERVERS
  // A kept tab that no longer exists (a server removed, fewer servers) falls back on a sensible one
  const place = where === 'local' ? 'local'
    : tabbed ? (servers.some(s => s.id === where) ? where : where === 'vps' && servers[0] ? servers[0].id : 'local')
    : 'vps'
  const remote = place !== 'local'

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
      setSelection(s => s ?? (first ? { kind: 'compose', name: first.name } : o.containers.some(c => !c.composeProject) ? { kind: 'standalone' } : { kind: 'images' }))
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

  // Active project only (its compose project), remembered per page
  const activeHub = useActiveHub()
  const [onlyActive, setOnlyActive] = usePersistentState('devforge:docker-only-active', false)
  const filterOn = onlyActive && !!activeHub?.composeName
  const compose = useMemo(() => [...(data?.compose ?? [])]
    .filter(c => !filterOn || c.name === activeHub?.composeName)
    .sort((a, b) => b.running - a.running || a.name.localeCompare(b.name)), [data, filterOn, activeHub])
  const standalone = useMemo(() => (filterOn ? [] : (data?.containers ?? []).filter(c => !c.composeProject)), [data, filterOn])
  const running = data?.containers.filter(c => c.state === 'running').length ?? 0
  const many = (n: number) => (lang === 'en' ? n !== 1 : n > 1)

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
  const subtitle = data?.available
    ? [d.subtitle.replace('{v}', data.version ?? ''),
      (many(running) ? d.runningMany : d.runningOne).replace('{n}', String(running)),
      (many(data.images.length) ? d.imagesMany : d.imagesOne).replace('{n}', String(data.images.length))].join(' · ')
    : d.subtitleOff
  const tabs = [{ value: 'local', label: d.thisPc }, ...(tabbed ? servers.map(s => ({ value: s.id, label: s.name })) : servers.length ? [{ value: 'vps', label: t.watch.vps }] : [])]

  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupOnline} title={d.title} subtitle={remote ? d.subtitleRemote : subtitle}
        actions={<>
          {tabs.length > 1 && <Tabs<string> value={place} onChange={setWhere} items={tabs} />}
          {!remote && (
            <>
              {activeHub?.composeName && <FilterChip on={filterOn} label={t.hub.onlyActive.replace('{name}', activeHub.project.name)} onClick={() => setOnlyActive(v => !v)} />}
              <Button variant="secondary" onClick={reload} loading={loading}>{!loading && <RefreshCw size={14} aria-hidden />} {t.common.refresh}</Button>
              <Button variant="secondary" onClick={() => setPruning('confirm')} disabled={!data?.available}><Eraser size={14} aria-hidden /> {d.prune}</Button>
            </>
          )}
        </>}
      />

      {remote ? <RemoteDocker key={place} connections={servers} connectionId={place === 'vps' ? undefined : place} /> : data && !data.available ? (
        <EmptyState icon={<Container size={32} />} title={d.unavailable} description={data.error} />
      ) : !data ? <Spinner /> : (
        // The menu stands beside the details; on a narrow page (a small window, Forgy's panel open) it spreads in columns above them
        <div className="@container">
          <div className="flex flex-col gap-4 @min-[720px]:flex-row @min-[720px]:items-start">
            <nav aria-label="Docker" className="df-rise grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-3 gap-y-1 @min-[720px]:flex @min-[720px]:w-[260px] @min-[720px]:shrink-0 @min-[720px]:flex-col @min-[720px]:gap-1" style={{ '--i': 1 } as CSSProperties}>
              <NavTitle>{d.navCompose}</NavTitle>
              {compose.length === 0 && <span className="col-span-full px-3 py-2 text-sm text-fg-muted">{d.noCompose}</span>}
              {compose.map(p => (
                <NavItem key={p.name} label={p.name} meta={`${p.running}/${p.total}`} live={p.running > 0}
                  active={selection?.kind === 'compose' && selection.name === p.name} onClick={() => setSelection({ kind: 'compose', name: p.name })} />
              ))}
              <span className="col-span-full h-3" aria-hidden />
              <NavTitle>{d.navOthers}</NavTitle>
              <NavItem label={d.standalone} meta={String(standalone.length)} live={null}
                active={selection?.kind === 'standalone'} onClick={() => setSelection({ kind: 'standalone' })} />
              <NavItem label={d.images} meta={String(data.images.length)} live={null}
                active={selection?.kind === 'images'} onClick={() => setSelection({ kind: 'images' })} />
            </nav>

            <section className="df-rise flex min-w-0 flex-1 flex-col gap-4" style={{ '--i': 2 } as CSSProperties}>
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
              {selection?.kind === 'standalone' && (
                <StandaloneDetail containers={standalone} busy={busy}
                  onContainer={(c, a) => withBusy(c.id, () => window.devforge.docker.container(c.id, a), c.name)} />
              )}
              {selection?.kind === 'images' && (
                <Card>
                  {data.images.length === 0 ? <p className="px-4.5 py-4 text-sm text-fg-muted">{d.noImages}</p> : (
                    <Table>
                      <thead>
                        <tr>
                          <Th className="pl-4.5">{d.colImage}</Th>
                          <Th>{d.colId}</Th>
                          <Th>{d.colCreated}</Th>
                          <Th align="right" className="pr-4.5">{d.colSize}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.images.map(img => (
                          <tr key={img.id + img.tag}>
                            <Td className="max-w-[320px] truncate pl-4.5 font-mono text-xs text-fg" title={`${img.repository}:${img.tag}`}>{img.repository}<span className="text-fg-muted">:{img.tag}</span></Td>
                            <Td className="font-mono text-xs text-fg-muted">{img.id}</Td>
                            <Td className="text-xs whitespace-nowrap text-fg-secondary">{img.createdSince}</Td>
                            <Td align="right" className="pr-4.5 font-mono text-xs text-fg">{img.size}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  )}
                </Card>
              )}
              {!selectedCompose && !selection && <EmptyState title={d.noContainers} />}
            </section>
          </div>
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
