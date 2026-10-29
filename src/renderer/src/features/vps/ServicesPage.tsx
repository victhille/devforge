import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { AppWindow, ExternalLink, Globe, Lock, RefreshCw } from 'lucide-react'
import type { SSHConnection, VpsService } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import EmptyState from '@renderer/components/ui/EmptyState'
import Spinner from '@renderer/components/ui/Spinner'
import { Page, PageHeader } from '@renderer/components/ui/Page'
import { ServerSelect, useServerPicker } from './ServerPicker'
import NeedsSetup from '@renderer/components/NeedsSetup'
import { errorText } from '@renderer/lib/errors'

export default function ServicesPage() {
  const { t } = useI18n()
  const { connections, conn, serverId, setServerId } = useServerPicker()
  return (
    <Page>
      <PageHeader title={t.nav.services} subtitle={t.vpsOps.servicesSubtitle} actions={<ServerSelect connections={connections} value={serverId} onChange={setServerId} />} />
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

  if (error) return <Card className="p-[18px] text-sm text-danger">{error}</Card>
  if (!list) return <Spinner />
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end"><Button variant="secondary" onClick={load}><RefreshCw size={14} /> {o.refresh}</Button></div>
      {list.length === 0 ? <EmptyState title={o.servicesNone} /> : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((s, i) => (
            <Card key={`${s.container}:${s.port}`} className="df-rise flex flex-col gap-3 p-4" style={{ '--i': i } as CSSProperties}>
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><AppWindow size={19} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-[14px] font-semibold text-fg">{s.name}</h3>
                    <span className={cn('size-1.5 shrink-0 rounded-full', s.running ? 'bg-success' : 'bg-fg-disabled')} title={s.running ? s.status : o.stopped} />
                  </div>
                  <div className="truncate font-mono text-[11.5px] text-fg-muted" title={s.image}>{s.image}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md border border-line-subtle bg-canvas px-2 py-0.5 font-mono text-fg-secondary">{s.scheme}://…:{s.port}</span>
                {s.exposed
                  ? <span className="flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 font-medium text-warning" title={o.exposedHint}><Globe size={12} /> {o.exposed}</span>
                  : <span className="flex items-center gap-1 text-fg-muted"><Lock size={12} /> {o.local}</span>}
              </div>
              {tunnels[s.port] && <div className="truncate font-mono text-[11.5px] text-fg-muted">{o.tunnelOpen.replace('{url}', tunnels[s.port]!)}</div>}
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
