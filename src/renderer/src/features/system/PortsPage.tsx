import { useState, useEffect, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RefreshCw, Search, Wifi, XCircle } from 'lucide-react'
import type { ListeningPort, PortProject } from '@shared/types'
import { reachableFromNetwork } from '@shared/lib/netAddress'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { isDevPort, processLabel } from '@renderer/lib/ports'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Notice from '@renderer/components/ui/Notice'
import SearchInput from '@renderer/components/ui/SearchInput'
import { Table, Td, Th } from '@renderer/components/ui/Table'
import Tabs from '@renderer/components/ui/Tabs'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { errorText } from '@renderer/lib/errors'
import { confirmDialog } from '@renderer/app/ConfirmContext'

// Well-known ports for display hints
const WELL_KNOWN: Record<number, string> = {
  80: 'HTTP', 443: 'HTTPS', 3000: 'Dev', 3001: 'Dev', 4200: 'Angular',
  5000: 'Flask', 5173: 'Vite', 8000: 'Django', 8080: 'HTTP-alt',
  8443: 'HTTPS-alt', 5432: 'Postgres', 3306: 'MySQL', 6379: 'Redis',
  27017: 'MongoDB', 9229: 'Node Debug'
}

export default function PortsPage() {
  const { t } = useI18n()
  const p = t.ports
  const toast = useToast()
  const [ports,   setPorts]   = useState<ListeningPort[]>([])
  const [owners,  setOwners]  = useState<PortProject[]>([])
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
    try {
      const list = await window.devforge.getListeningPorts()
      if (alive.current) setPorts(list)
    } finally {
      if (alive.current) setLoading(false)
    }
    // The project of each port comes after: it reads the command line of every process
    window.devforge.suggest.portProjects()
      .then(o => { if (alive.current && mine === round.current) setOwners(o) })
      .catch(() => { if (alive.current && mine === round.current) setOwners([]) })
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

  return (
    <Page>
      <PageHeader
        crumb={t.nav.groupSystem}
        title={p.title}
        subtitle={loading && ports.length === 0 ? p.scanning : p.subtitle.replace('{n}', String(inScope.length))}
        actions={
          <>
            <Tabs<'dev' | 'all'> value={scope} onChange={setScope} items={[{ value: 'dev', label: p.showDev }, { value: 'all', label: p.showAll }]} />
            <Button variant="secondary" onClick={refresh} loading={loading}>
              {!loading && <RefreshCw size={14} />} {p.refresh}
            </Button>
          </>
        }
      />

      {loading && ports.length === 0 ? (
        <p className="py-16 text-center text-fg-muted">{p.scanning}</p>
      ) : inScope.length === 0 ? (
        <EmptyState icon={<Wifi size={32} />} title={p.noResults} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput className="w-full max-w-80" value={query} onChange={setQuery} placeholder={p.search} />
            <Notice tone="neutral" className="min-w-64 flex-1 py-2 text-sm">{p.freeNote}</Notice>
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={<Search size={32} />} title={p.noMatch.replace('{q}', query.trim())} />
          ) : (
            <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
              <Table>
                <thead>
                  <tr>
                    <Th>{p.port}</Th>
                    <Th>{p.process}</Th>
                    <Th>{p.pid}</Th>
                    <Th>{p.project}</Th>
                    <Th>{p.address}</Th>
                    <Th><span className="sr-only">{p.free}</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(port => {
                    const owner = ownerOf(port.port)
                    const network = reachableFromNetwork(port.address)
                    return (
                      <tr key={`${port.port}:${port.pid}`} className="group">
                        <Td>
                          <div className="flex items-center gap-2">
                            <button onClick={() => window.devforge.openExternal(`http://localhost:${port.port}`)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-elevated px-2.5 py-1 font-mono text-xs font-medium text-fg hover:text-accent">
                              {port.port} <ExternalLink size={10} className="opacity-50" />
                            </button>
                            {WELL_KNOWN[port.port] && <span className="font-mono text-xs text-fg-muted">{WELL_KNOWN[port.port]}</span>}
                          </div>
                        </Td>
                        <Td className="font-medium text-fg">{port.processName ? processLabel(port.processName) : '—'}</Td>
                        <Td className="font-mono text-xs text-fg-muted">{port.pid ?? '—'}</Td>
                        <Td>
                          {owner
                            ? <Link to={`/project/${owner.projectId}`} className="text-fg-secondary hover:text-accent">{owner.projectName}</Link>
                            : <span className="text-fg-disabled">—</span>}
                        </Td>
                        <Td>
                          {port.address ? (
                            <span className="flex items-center gap-2" title={network ? p.networkHint : p.localHint}>
                              <span className="font-mono text-xs text-fg-secondary">{port.address}</span>
                              {network && <Badge color="warning">{p.network}</Badge>}
                            </span>
                          ) : <span className="text-fg-disabled">—</span>}
                        </Td>
                        <Td align="right">
                          {port.pid !== null && port.pid > 4 && (
                            <button onClick={() => free(port)} disabled={freeing === port.port}
                              className={cn('inline-flex h-7 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-2.5 text-xs font-medium text-danger transition-[opacity,background-color] hover:bg-danger hover:text-danger-fg',
                                freeing === port.port ? 'opacity-60' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100')}>
                              <XCircle size={12} /> {p.free}
                            </button>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </Page>
  )
}
