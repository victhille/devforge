import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppWindow, ExternalLink, Globe, RefreshCw } from 'lucide-react'
import type { SSHConnection, VpsService } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from './ServerPicker'
import NeedsSetup from '@renderer/components/NeedsSetup'
import Notice from '@renderer/components/ui/Notice'
import { errorText } from '@renderer/lib/errors'

/** A tint per known service, as the mock-up's tiles (the theme's colors) */
const TINT: Record<string, string> = {
  portainer: 'bg-info-soft text-info',
  adminer: 'bg-warning-soft text-warning',
  phpmyadmin: 'bg-warning-soft text-warning',
  pgadmin: 'bg-info-soft text-info',
  'wg-easy': 'bg-success-soft text-success',
  n8n: 'bg-accent-soft text-accent',
  grafana: 'bg-accent-soft text-accent',
  'uptime-kuma': 'bg-success-soft text-success'
}

export default function ServicesPage() {
  const { t } = useI18n()
  const picker = useServerPicker()
  const { connections, conn } = picker
  if (connections && conn) return <Page className="df-mockup"><Services key={conn.id} conn={conn} picker={picker} /></Page>
  return (
    <Page className="df-mockup">
      <PageHeader crumb={t.nav.groupServers} title={t.nav.services} subtitle={t.vpsOps.servicesSubtitle} />
      {!connections ? <Spinner /> : <NeedsSetup service="server" />}
    </Page>
  )
}

/**
 * As in the mock-up: one card per web interface of the server's containers,
 * its port (and the local one once its tunnel is open), what it is for, and
 * Open; the VPN's interface is also managed in DevForge.
 */
function Services({ conn, picker }: { conn: SSHConnection; picker: ReturnType<typeof useServerPicker> }) {
  const { t } = useI18n()
  const o = t.vpsOps
  const toast = useToast()
  const navigate = useNavigate()
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

  const header = (
    <>
      <PageHeader crumb={`${t.nav.groupServers} · ${conn.name}`} title={t.nav.services} subtitle={o.servicesSubtitle}
        actions={<>
          <ServerSelect connections={picker.connections} value={picker.serverId} onChange={picker.setServerId} />
          <Button variant="secondary" onClick={load}><RefreshCw size={14} aria-hidden /> {o.refresh}</Button>
        </>} />
      <Notice tone="info">{o.servicesTunnel}</Notice>
    </>
  )

  if (error) return <>{header}<Card className="p-4.5 text-sm text-danger">{error}</Card></>
  if (!list) return <>{header}<Spinner /></>
  return (
    <>
      {header}
      {list.length === 0 ? <EmptyState title={o.servicesNone} /> : (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => {
            const local = tunnels[s.port] ? new URL(tunnels[s.port]!).port : null
            return (
              <Card key={`${s.container}:${s.port}`} className="df-rise flex flex-col gap-3 p-4.5" style={{ '--i': i } as CSSProperties}>
                <div className="flex items-start gap-3">
                  <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-control', TINT[s.kind] ?? 'bg-active text-fg-secondary')}><AppWindow size={18} aria-hidden /></div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-display text-md font-bold tracking-[-.01em] text-fg">{s.name}</h2>
                    <div className="truncate font-mono text-xs text-fg-muted" title={s.image}>:{s.port}{local && ` → localhost:${local}`}</div>
                  </div>
                  {local ? <Badge color="success">{o.tunnelOpened}</Badge>
                    : !s.running ? <Badge>{o.stopped}</Badge>
                    : <Badge>{o.tunnelClosed}</Badge>}
                </div>
                <p className="text-sm text-fg-secondary">{o.serviceDesc[s.kind] ?? <span className="font-mono text-xs">{s.image}</span>}</p>
                {s.exposed && (
                  <span title={o.exposedHint} className="inline-flex self-start"><Badge color="warning"><Globe size={12} aria-hidden /> {o.exposed}</Badge></span>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <Button size="sm" variant={local ? 'primary' : 'secondary'} disabled={!s.running} loading={busy === s.port} onClick={() => open(s)}>
                    {busy !== s.port && <ExternalLink size={13} aria-hidden />} {o.open}
                  </Button>
                  {s.kind === 'wg-easy' && <Button size="sm" variant="secondary" onClick={() => navigate('/vpn')}>{o.manageInDevforge}</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
