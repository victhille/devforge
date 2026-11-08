import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AppWindow, ExternalLink, Globe, Lock, RefreshCw } from 'lucide-react'
import type { SSHConnection, VpsService } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from './ServerPicker'
import NeedsSetup from '@renderer/components/NeedsSetup'
import Notice from '@renderer/components/ui/Notice'
import { errorText } from '@renderer/lib/errors'

export default function ServicesPage() {
  const { t } = useI18n()
  const { connections, conn, serverId, setServerId } = useServerPicker()
  return (
    <Page>
      <PageHeader crumb={conn ? `${t.nav.groupServers} · ${conn.name}` : t.nav.groupServers} title={t.nav.services} subtitle={t.vpsOps.servicesSubtitle} actions={<ServerSelect connections={connections} value={serverId} onChange={setServerId} />} />
      {conn && <Notice tone="info">{t.vpsOps.servicesTunnel}</Notice>}
      {!connections ? <Spinner /> : !conn ? <NeedsSetup service="server" /> : <Services key={conn.id} conn={conn} />}
    </Page>
  )
}

function Services({ conn }: { conn: SSHConnection }) {
  const { t } = useI18n()
  const o = t.vpsOps
  const toast = useToast()
  const [list, setList] = useState<VpsService[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [tunnels, setTunnels] = useState<Record<number, string>>({})

  const load = useCallback(() => {
    setError('')
    window.devforge.vpsOps.services(conn.id).then(setList).catch(err => setError(errorText(err)))
  }, [conn.id])
  useEffect(() => { load() }, [load])

  async function open(s: VpsService) {
    setBusy(s.port)
    try {
      const url = await window.devforge.vpsOps.openService(conn.id, s.port, s.scheme)
      setTunnels(x => ({ ...x, [s.port]: url }))
      window.devforge.openExternal(url)
    } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
    finally { setBusy(null) }
  }

  if (error) return <Card className="p-4.5 text-sm text-danger">{error}</Card>
  if (!list) return <Spinner />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><Button variant="secondary" onClick={load}><RefreshCw size={14} /> {o.refresh}</Button></div>
      {list.length === 0 ? <EmptyState title={o.servicesNone} /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => (
            <Card key={`${s.container}:${s.port}`} className="df-rise flex flex-col gap-3 p-4" style={{ '--i': i } as CSSProperties}>
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-control bg-accent-soft text-accent"><AppWindow size={18} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="truncate">{s.name}</CardTitle>
                    <span className={cn('size-1.5 shrink-0 rounded-full', s.running ? 'bg-success' : 'bg-fg-disabled')} title={s.running ? s.status : o.stopped} />
                  </div>
                  <div className="truncate font-mono text-xs text-fg-muted" title={s.image}>{s.image}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge mono>{s.scheme}://…:{s.port}</Badge>
                {s.exposed
                  ? <span title={o.exposedHint} className="inline-flex"><Badge color="warning"><Globe size={12} /> {o.exposed}</Badge></span>
                  : <Badge><Lock size={12} /> {o.local}</Badge>}
              </div>
              {tunnels[s.port] && <div className="truncate font-mono text-xs text-fg-muted">{o.tunnelOpen.replace('{url}', tunnels[s.port]!)}</div>}
              <Button variant="secondary" className="self-start" disabled={!s.running} loading={busy === s.port} onClick={() => open(s)}>
                {busy !== s.port && <ExternalLink size={14} />} {o.open}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
