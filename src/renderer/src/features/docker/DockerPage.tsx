import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Container, Eraser, Layers, RefreshCw } from 'lucide-react'
import type { DockerOverview, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Modal from '@renderer/components/ui/Modal'
import Spinner from '@renderer/components/ui/Spinner'
import { Page } from '@renderer/components/ui/Page'
import { useAssistantPageContext } from '@renderer/features/assistant/AssistantContext'
import { ComposeDetail, ContainerDetail, hostPorts } from './ComposeDetail'
import RemoteDocker from './RemoteDocker'
import Tabs from '@renderer/components/ui/Tabs'
import { useActiveHub } from '@renderer/hooks/useActiveHub'
import { usePersistentState } from '@renderer/hooks/usePersistentState'

/** What the right side shows */
type Selection = { kind: 'compose'; name: string } | { kind: 'container'; id: string } | { kind: 'images' }

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

const FilterChip = ({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) => (
  <button onClick={onClick} aria-pressed={on}
    className={cn('h-9 rounded-full border px-3.5 text-[12.5px] font-medium transition-colors', on ? 'border-accent/40 bg-active text-fg' : 'border-line bg-surface text-fg-secondary hover:text-fg')}>
    {label}
  </button>
)

export default function DockerPage() {
  const { t } = useI18n()
  const d = t.docker
  const toast = useToast()
  const [data, setData] = useState<DockerOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [pruning, setPruning] = useState<'confirm' | 'running' | null>(null)
  // Local Docker, or a VPS through SSH
  const [where, setWhere] = usePersistentState<'local' | 'vps'>('devforge:docker-where', 'local')
  const [servers, setServers] = useState<SSHConnection[]>([])
  useEffect(() => { window.devforge.getSshConnections().then(setServers).catch(() => {}) }, [])

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

  // Active project only (its compose project), remembered per page
  const activeHub = useActiveHub()
  const [onlyActive, setOnlyActive] = usePersistentState('devforge:docker-only-active', false)
  const filterOn = onlyActive && !!activeHub?.composeName
  const compose = useMemo(() => [...(data?.compose ?? [])]
    .filter(c => !filterOn || c.name === activeHub?.composeName)
    .sort((a, b) => b.running - a.running || a.name.localeCompare(b.name)), [data, filterOn, activeHub])
  const standalone = useMemo(() => (filterOn ? [] : (data?.containers ?? []).filter(c => !c.composeProject)), [data, filterOn])
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
        <Tabs<'local' | 'vps'> value={where} onChange={setWhere} items={[{ value: 'local', label: t.watch.local }, { value: 'vps', label: t.watch.vps }]} />
        {where === 'local' && (
          <>
            {activeHub?.composeName && <FilterChip on={filterOn} label={t.hub.onlyActive.replace('{name}', activeHub.project.name)} onClick={() => setOnlyActive(v => !v)} />}
            <Button variant="secondary" onClick={reload} loading={loading}>{!loading && <RefreshCw size={14} />} {t.common.refresh}</Button>
            <Button variant="secondary" onClick={() => setPruning('confirm')} disabled={!data?.available}><Eraser size={14} /> {d.prune}</Button>
          </>
        )}
      </header>

      {where === 'vps' ? <RemoteDocker connections={servers} /> : data && !data.available ? (
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
