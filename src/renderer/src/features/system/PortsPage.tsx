import { useState, useEffect } from 'react'
import { RefreshCw, Wifi } from 'lucide-react'
import type { ListeningPort } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Page, PageHeader } from '@renderer/components/ui/Page'

// Well-known ports for display hints
const WELL_KNOWN: Record<number, string> = {
  80: 'HTTP', 443: 'HTTPS', 3000: 'Dev', 3001: 'Dev', 4200: 'Angular',
  5000: 'Flask', 5173: 'Vite', 8000: 'Django', 8080: 'HTTP-alt',
  8443: 'HTTPS-alt', 5432: 'Postgres', 3306: 'MySQL', 6379: 'Redis',
  27017: 'MongoDB', 9229: 'Node Debug'
}

function portTone(port: number): string {
  if (port < 1024) return 'text-warning bg-warning-soft border-warning/25'
  if (port < 8000) return 'text-accent bg-accent-soft border-accent/25'
  if (port < 9000) return 'text-success bg-success-soft border-success/25'
  return 'text-violet-400 bg-violet-400/10 border-violet-400/25'
}

const TH = 'px-4 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-fg-muted'

export default function PortsPage() {
  const { t } = useI18n()
  const [ports,   setPorts]   = useState<ListeningPort[]>([])
  const [loading, setLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      setPorts(await window.devforge.getListeningPorts())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <Page>
      <PageHeader
        title={t.ports.title}
        subtitle={loading && ports.length === 0 ? t.ports.scanning : t.ports.subtitle.replace('{n}', String(ports.length))}
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
            <RefreshCw size={13} /> {t.ports.refresh}
          </Button>
        }
      />

      {loading && ports.length === 0 ? (
        <p className="py-16 text-center text-fg-muted">{t.ports.scanning}</p>
      ) : ports.length === 0 ? (
        <EmptyState icon={<Wifi size={32} />} title={t.ports.noResults} />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="border-b border-line-subtle">
              <tr>
                <th className={TH}>{t.ports.port}</th>
                <th className={TH}>{t.ports.process}</th>
                <th className={TH}>{t.ports.pid}</th>
              </tr>
            </thead>
            <tbody>
              {ports.map(p => (
                <tr key={p.port} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-elevated">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded border px-2 py-0.5 font-mono text-sm font-semibold', portTone(p.port))}>
                        :{p.port}
                      </span>
                      {WELL_KNOWN[p.port] && (
                        <span className="rounded bg-elevated px-1.5 py-px text-2xs text-fg-muted">{WELL_KNOWN[p.port]}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-fg">{p.processName || '—'}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-fg-muted">{p.pid ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  )
}
