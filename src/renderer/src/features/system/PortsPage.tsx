import { useState, useEffect, type CSSProperties } from 'react'
import { ExternalLink, RefreshCw, Wifi, XCircle } from 'lucide-react'
import type { ListeningPort } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import { isDevPort, processLabel } from '@renderer/lib/ports'
import { usePersistentState } from '@renderer/hooks/usePersistentState'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
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
  const [loading, setLoading] = useState(false)
  const [freeing, setFreeing] = useState<number | null>(null)
  const [scope,   setScope]   = usePersistentState<'dev' | 'all'>('devforge:ports-scope', 'dev')

  async function refresh() {
    setLoading(true)
    try {
      setPorts(await window.devforge.getListeningPorts())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

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

  const shown = scope === 'dev' ? ports.filter(isDevPort) : ports

  return (
    <Page>
      <PageHeader
        crumb={t.nav.groupSystem}
        title={p.title}
        subtitle={loading && ports.length === 0 ? p.scanning : p.subtitle.replace('{n}', String(shown.length))}
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
      ) : shown.length === 0 ? (
        <EmptyState icon={<Wifi size={32} />} title={p.noResults} />
      ) : (
        <Card className="df-rise overflow-hidden" style={{ '--i': 1 } as CSSProperties}>
          <Table>
            <thead>
              <tr>
                <Th>{p.port}</Th>
                <Th>{p.process}</Th>
                <Th>{p.pid}</Th>
                <Th><span className="sr-only">{p.free}</span></Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(port => (
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
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </Page>
  )
}
