import { useEffect, useState } from 'react'
import type { SSHConnection, VpsStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { formatRelative } from '@renderer/lib/format'
import Card from '@renderer/components/ui/Card'
import Switch from '@renderer/components/ui/Switch'
import { SectionTitle } from '@renderer/components/ui/Page'
import { TimeChart, UptimeStrip } from '@renderer/components/charts/TimeChart'
import { useHistory, useWatch } from '@renderer/hooks/useWatch'

const pct = (v: number) => `${Math.round(v)} %`

function ServerCard({ conn, status, watched, threshold, onToggle }: {
  conn: SSHConnection; status?: VpsStatus; watched: boolean; threshold: number; onToggle: (on: boolean) => void
}) {
  const { t, lang } = useI18n()
  const w = t.watch
  const history = useHistory(watched ? `vps:${conn.id}` : null)
  const points = history?.points ?? []
  const running = status?.containers.filter(c => c.running).length ?? 0
  const state = !watched ? w.off : !status || status.state === 'connecting' ? w.connecting : status.state === 'down' ? w.down : status.at ? w.lastSample.replace('{when}', formatRelative(new Date(status.at).toISOString(), lang)) : ''

  return (
    <Card className="flex flex-col gap-4 p-[18px]">
      <div className="flex flex-wrap items-center gap-3">
        <span className={cn('size-2.5 shrink-0 rounded-full', !watched ? 'bg-fg-disabled' : status?.state === 'ok' ? 'df-ping bg-success' : status?.state === 'down' ? 'bg-danger' : 'bg-warning')} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-fg">{conn.name}</div>
          <div className={cn('font-mono text-xs', status?.state === 'down' && watched ? 'text-danger' : 'text-fg-muted')} title={status?.error}>
            {conn.username}@{conn.host} · {state}
          </div>
        </div>
        {watched && status?.state === 'ok' && <span className="font-mono text-xs text-fg-secondary">{w.containers.replace('{r}', String(running)).replace('{t}', String(status.containers.length))}</span>}
        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          <Switch checked={watched} onChange={onToggle} label={w.watched} /> {w.watched}
        </label>
      </div>
      {watched && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <TimeChart points={points} field={0} max={100} label={w.cpu} format={pct} />
          <TimeChart points={points} field={1} max={100} label={w.memory} format={pct} />
          <TimeChart points={points} field={2} max={100} label={w.disk} format={pct} threshold={threshold} />
          <div className="md:col-span-3">
            <UptimeStrip points={points} field={3} labels={{ up: w.stateUp, partial: w.statePartial, down: w.stateDown, none: w.stateNone }} />
          </div>
        </div>
      )}
    </Card>
  )
}

/** Monitoring page: the watched servers with 24 h of CPU, memory, disk and uptime */
export default function ServersSection() {
  const { t } = useI18n()
  const w = t.watch
  const { statuses, config, saveConfig } = useWatch()
  const [connections, setConnections] = useState<SSHConnection[]>([])
  useEffect(() => { window.devforge.getSshConnections().then(setConnections).catch(() => {}) }, [])
  if (!config) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle className="flex-1">{w.serversTitle} · {w.last24h}</SectionTitle>
        <label className="flex items-center gap-2 text-sm text-fg-secondary">
          {w.diskAlert}
          <select value={config.diskAlert} onChange={e => saveConfig({ diskAlert: Number(e.target.value) })}
            className="h-8 rounded-lg border border-line bg-canvas px-2 font-mono text-sm text-fg outline-none">
            {[70, 75, 80, 85, 90, 95].map(v => <option key={v} value={v}>{v} %</option>)}
          </select>
        </label>
      </div>
      {connections.length === 0 && <p className="text-sm text-fg-muted">{w.noServers}</p>}
      {connections.map(c => (
        <ServerCard key={c.id} conn={c} status={statuses.find(s => s.connectionId === c.id)} watched={config.watched.includes(c.id)} threshold={config.diskAlert}
          onToggle={on => saveConfig({ watched: on ? [...config.watched, c.id] : config.watched.filter(x => x !== c.id) })} />
      ))}
      <p className="text-xs text-fg-muted">{w.serversHint}</p>
    </section>
  )
}

/** 24 h of one site: uptime per half hour and response time */
export function SiteHistory({ monitorId }: { monitorId: string }) {
  const { t } = useI18n()
  const w = t.watch
  const series = useHistory(`site:${monitorId}`, 24, 30)
  const points = series?.points ?? []
  const ups = points.map(p => p.v[0]).filter((v): v is number => v !== null)
  const uptime = ups.length ? Math.round((ups.reduce((a, b) => a + b, 0) / ups.length) * 1000) / 10 : null
  if (!points.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 px-4 pb-4 md:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-fg-secondary">{uptime === null ? w.last24h : w.uptime24.replace('{p}', String(uptime))}</span>
        <UptimeStrip points={points} field={0} labels={{ up: w.stateUp, partial: w.statePartial, down: w.stateDown, none: w.stateNone }} />
      </div>
      <TimeChart points={points} field={1} label={w.latency} format={v => `${Math.round(v)} ms`} height={48} />
    </div>
  )
}
