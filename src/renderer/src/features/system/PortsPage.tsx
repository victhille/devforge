import { useState, useEffect } from 'react'
import { RefreshCw, Wifi } from 'lucide-react'
import type { ListeningPort } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import styles from './PortsPage.module.css'

// Well-known ports for display hints
const WELL_KNOWN: Record<number, string> = {
  80: 'HTTP', 443: 'HTTPS', 3000: 'Dev', 3001: 'Dev', 4200: 'Angular',
  5000: 'Flask', 5173: 'Vite', 8000: 'Django', 8080: 'HTTP-alt',
  8443: 'HTTPS-alt', 5432: 'Postgres', 3306: 'MySQL', 6379: 'Redis',
  27017: 'MongoDB', 9229: 'Node Debug'
}

function portColor(port: number): string {
  if (port < 1024)  return '#F5A623'
  if (port < 8000)  return '#4F8EF7'
  if (port < 9000)  return '#3DD68C'
  return '#A78BFA'
}

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
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.ports.title}</h1>
          <p className={styles.subtitle}>
            {loading && ports.length === 0
              ? t.ports.scanning
              : t.ports.subtitle.replace('{n}', String(ports.length))}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
          <RefreshCw size={13} /> {t.ports.refresh}
        </Button>
      </div>

      {loading && ports.length === 0 ? (
        <div className={styles.loading}>{t.ports.scanning}</div>
      ) : ports.length === 0 ? (
        <div className={styles.empty}>
          <Wifi size={32} style={{ color: 'var(--text-muted)' }} />
          <p>{t.ports.noResults}</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t.ports.port}</th>
                <th>{t.ports.process}</th>
                <th>{t.ports.pid}</th>
              </tr>
            </thead>
            <tbody>
              {ports.map(p => (
                <tr key={p.port} className={styles.row}>
                  <td>
                    <div className={styles.portCell}>
                      <span className={styles.portBadge} style={{ color: portColor(p.port), borderColor: `${portColor(p.port)}40`, background: `${portColor(p.port)}12` }}>
                        :{p.port}
                      </span>
                      {WELL_KNOWN[p.port] && (
                        <span className={styles.portHint}>{WELL_KNOWN[p.port]}</span>
                      )}
                    </div>
                  </td>
                  <td className={styles.processName}>{p.processName || '—'}</td>
                  <td className={styles.pid}>{p.pid ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
