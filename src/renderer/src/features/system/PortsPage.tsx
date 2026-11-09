import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RefreshCw, Search, Wifi } from 'lucide-react'
import type { ListeningPort, PortProject } from '@shared/types'
import { reachableFromNetwork } from '@shared/lib/netAddress'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { isDevPort, processLabel } from '@renderer/lib/ports'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'
import IconButton from '@renderer/components/ui/IconButton'
import Notice from '@renderer/components/ui/Notice'
import SearchInput from '@renderer/components/ui/SearchInput'
import { TableSkeleton } from '@renderer/components/ui/Skeleton'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'

// Well-known ports: their name on hover
const WELL_KNOWN: Record<number, string> = {
  80: 'HTTP', 443: 'HTTPS', 3000: 'Dev', 3001: 'Dev', 4200: 'Angular',
  5000: 'Flask', 5173: 'Vite', 8000: 'Django', 8080: 'HTTP-alt',
  8443: 'HTTPS-alt', 5432: 'Postgres', 3306: 'MySQL', 6379: 'Redis',
  27017: 'MongoDB', 9229: 'Node Debug'
}
/** Ports that are not web pages: no « open in the browser » */
const NOT_WEB = new Set([5432, 3306, 6379, 27017, 9229, 11211, 5672, 1433])

/** PIDs grouped by thousands with a thin space, as in the mock-up (18 204) */
const pidText = (pid: number) => String(pid).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

export default function PortsPage() {
  const { t } = useI18n()
  const p = t.ports
  const toast = useToast()
  const [ports,   setPorts]   = useState<ListeningPort[]>([])
  const [owners,  setOwners]  = useState<PortProject[]>([])
  /** The projects of the ports are known (they come after the ports) */
  const [ownersReady, setOwnersReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [freeing, setFreeing] = useState<number | null>(null)
  const [query,   setQuery]   = useState('')
  const [scope,   setScope]   = usePersistentState<'dev' | 'all'>('devforge:ports-scope', 'dev')
  const alive = useRef(true)
  /** The latest refresh: an older answer that comes after it is dropped */
  const round = useRef(0)

  async function refresh() {
    const mine = ++round.current
    setLoading(true)
    setOwnersReady(false)
    try {
      const list = await window.devforge.getListeningPorts()
      if (alive.current) setPorts(list)
    } finally {
      if (alive.current) setLoading(false)
    }
    // The project of each port comes after: it reads the command line of every process
    window.devforge.suggest.portProjects()
      .then(o => { if (alive.current && mine === round.current) { setOwners(o); setOwnersReady(true) } })
      .catch(() => { if (alive.current && mine === round.current) { setOwners([]); setOwnersReady(true) } })
  }

  useEffect(() => {
    alive.current = true
    refresh()
    return () => { alive.current = false }
  }, [])

  async function free(port: ListeningPort) {
    if (port.pid === null) return
    const name = processLabel(port.processName)
    if (!(await confirmDialog(p.freeConfirm.replace('{name}', name).replace('{pid}', String(port.pid)).replace('{port}', String(port.port)), { danger: true }))) return
    setFreeing(port.port)
    try {
      await window.devforge.freePort(port.port, port.pid)
      toast.show({ tone: 'success', title: p.freed.replace('{port}', String(port.port)) })
    } catch (err) {
      toast.show({ tone: 'error', title: p.freeFailed.replace('{port}', String(port.port)), description: errorText(err) })
    } finally {
      setFreeing(null)
      refresh()
    }
  }

  const ownerOf = (port: number) => owners.find(o => o.port === port)
  const inScope = scope === 'dev' ? ports.filter(isDevPort) : ports
  const q = query.trim().toLowerCase()
  const shown = q
    ? inScope.filter(x => `${x.port} ${processLabel(x.processName)} ${x.pid ?? ''} ${ownerOf(x.port)?.projectName ?? ''}`.toLowerCase().includes(q))
    : inScope
  // A dev port no project holds: most likely a server left open (said once the projects are known)
  // (a dev server's runtime, not a database or a system service)
  const stale = (x: ListeningPort) => ownersReady && isDevPort(x) && x.pid !== null && x.pid > 4 && !ownerOf(x.port)
    && /^(node|php|python3?|ruby|deno|bun)$/i.test(processLabel(x.processName))
  const orphan = shown.find(stale)

  return (
    <Page className="df-mockup">
      <PageHeader
        crumb={t.nav.groupSystem}
        title={p.title}
        subtitle={loading && ports.length === 0 ? p.scanning : (scope === 'dev' ? p.subtitle : p.subtitleAll).replace('{n}', String(inScope.length))}
        actions={
          <>
            <Tabs<'dev' | 'all'> value={scope} onChange={setScope} items={[{ value: 'dev', label: p.showDev }, { value: 'all', label: p.showAll }]} label={p.scope} />
            <Button variant="secondary" onClick={refresh} loading={loading}>
              {!loading && <RefreshCw size={14} aria-hidden />} {p.refresh}
            </Button>
          </>
        }
      />

      {loading && ports.length === 0 ? (
        <div className="overflow-hidden rounded-card border border-line-subtle bg-surface"><TableSkeleton label={p.scanning} rows={5} columns={6} /></div>
      ) : inScope.length === 0 ? (
        <EmptyState icon={<Wifi size={32} />} title={p.noResults} />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SearchInput className="w-full max-w-[280px]" value={query} onChange={setQuery} placeholder={p.search} />
            <p className="text-sm text-fg-muted">{p.freeNote}</p>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title={p.noMatch.replace('{q}', query.trim())} />
          ) : (
            <div className="df-rise overflow-hidden rounded-card border border-line-subtle bg-surface" style={{ '--i': 1 } as CSSProperties}>
              <Table>
                <thead>
                  <tr>
                    <Th>{p.port}</Th>
                    <Th>{p.process}</Th>
                    <Th>{p.pid}</Th>
                    <Th>{p.project}</Th>
                    <Th>{p.address}</Th>
                    <Th align="right">{p.actions}</Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(port => {
                    const owner = ownerOf(port.port)
                    const network = reachableFromNetwork(port.address)
                    const freeable = port.pid !== null && port.pid > 4
                    return (
                      <tr key={`${port.port}:${port.pid}`}>
                        <Td className="font-mono font-bold text-fg" title={WELL_KNOWN[port.port]}>{port.port}</Td>
                        <Td className="text-fg">{port.processName ? processLabel(port.processName) : '—'}</Td>
                        <Td className="font-mono text-fg-muted tabular-nums">{port.pid !== null ? pidText(port.pid) : '—'}</Td>
                        <Td>
                          {owner
                            ? <Link to={`/project/${owner.projectId}`} className="inline-flex h-5.5 items-center rounded-md bg-accent-soft px-2 text-xs font-semibold text-accent hover:underline">{owner.projectName}</Link>
                            : <Badge>{p.noProject}</Badge>}
                        </Td>
                        <Td>
                          {port.address ? (
                            <span className="flex items-center gap-2" title={network ? p.networkHint : p.localHint}>
                              <span className="font-mono text-fg-secondary">{port.address}</span>
                              {network && <Badge color="warning">{p.network}</Badge>}
                            </span>
                          ) : <span className="text-fg-disabled">—</span>}
                        </Td>
                        <Td align="right">
                          <span className="inline-flex items-center gap-1.5">
                            {!NOT_WEB.has(port.port) && (
                              <IconButton size="sm" title={p.open.replace('{port}', String(port.port))} onClick={() => window.devforge.openExternal(`http://localhost:${port.port}`)}>
                                <ExternalLink size={13} />
                              </IconButton>
                            )}
                            {freeable && (
                              <Button size="sm" variant={stale(port) ? 'danger' : 'ghost'} disabled={freeing === port.port} onClick={() => free(port)}
                                aria-label={p.freeAria.replace('{port}', String(port.port))}
                                className={cn(stale(port) && 'border border-danger/40 bg-transparent text-danger hover:bg-danger-soft')}>
                                {p.free}
                              </Button>
                            )}
                          </span>
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          )}
          {orphan && (
            <Notice tone="info" className="max-w-3xl">
              {p.orphanHint.replace('{port}', String(orphan.port)).replace('{process}', processLabel(orphan.processName))}
            </Notice>
          )}
        </>
      )}
    </Page>
  )
}
