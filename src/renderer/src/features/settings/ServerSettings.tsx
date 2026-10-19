import { useEffect, useState } from 'react'
import { Boxes, Check, Globe, HardDrive, ServerOff } from 'lucide-react'
import type { AlertKind, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Switch from '@renderer/components/ui/Switch'
import { useWatch } from '@renderer/hooks/useWatch'
import { Segmented, SettingRow, SettingsCard } from './parts'

const ALERTS: { kind: AlertKind; icon: typeof HardDrive; tone: string }[] = [
  { kind: 'disk', icon: HardDrive, tone: 'text-warning' },
  { kind: 'container', icon: Boxes, tone: 'text-accent' },
  { kind: 'server', icon: ServerOff, tone: 'text-danger' },
  { kind: 'site', icon: Globe, tone: 'text-success' }
]

/** Background watch: which servers, the disk threshold and which alerts notify */
export default function ServerSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n()
  const s = t.settings
  const w = t.watch
  const { statuses, config, saveConfig } = useWatch()
  const [connections, setConnections] = useState<SSHConnection[]>([])
  useEffect(() => { window.devforge.getSshConnections().then(setConnections).catch(() => {}) }, [])
  if (!config) return null

  const save = async (u: Parameters<typeof saveConfig>[0]) => { await saveConfig(u); onSaved() }
  const alertLabel: Record<AlertKind, string> = { disk: s.alertDisk, container: s.alertContainer, server: s.alertServer, site: s.alertSite }

  return (
    <SettingsCard title={s.nav.servers} hint={s.serversHint}>
      <div className="flex flex-col px-5 pb-1.5">
        {connections.length === 0 && <p className="border-t border-line-subtle py-3 text-sm text-fg-muted">{w.noServers}</p>}
        {connections.map(c => {
          const on = config.watched.includes(c.id)
          const st = statuses.find(x => x.connectionId === c.id)
          const state = !on ? w.off : st?.state === 'ok' ? `${w.disk} ${Math.round(st.disk ?? 0)} %` : st?.state === 'down' ? w.down : w.connecting
          return (
            <div key={c.id} className="flex items-center gap-3 border-t border-line-subtle py-3">
              <span className={cn('size-2.5 shrink-0 rounded-full', !on ? 'bg-fg-disabled' : st?.state === 'ok' ? 'bg-success' : st?.state === 'down' ? 'bg-danger' : 'bg-warning')} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium text-fg">{c.name}</div>
                <div className="truncate font-mono text-[11.5px] text-fg-muted">{c.username}@{c.host} · {state}</div>
              </div>
              <Switch checked={on} label={`${w.watched} · ${c.name}`}
                onChange={v => save({ watched: v ? [...config.watched, c.id] : config.watched.filter(x => x !== c.id) })} />
            </div>
          )
        })}
      </div>
      <SettingRow label={w.diskAlert} hint={s.diskAlertHint}>
        <Segmented<string> label={w.diskAlert} mono value={String(config.diskAlert)} onChange={v => save({ diskAlert: Number(v) })}
          items={[75, 80, 85, 90, 95].map(v => ({ value: String(v), label: `${v} %` }))} />
      </SettingRow>
      <div className="border-t border-line-subtle px-5 py-4">
        <div className="text-[13.5px] font-medium text-fg">{s.notifyWhen}</div>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {ALERTS.map(({ kind, icon: Icon, tone }) => {
            const on = config.alerts[kind]
            return (
              <button key={kind} type="button" role="switch" aria-checked={on} onClick={() => save({ alerts: { ...config.alerts, [kind]: !on } })}
                className={cn('flex items-center gap-2.5 rounded-[10px] border bg-canvas p-3 text-left text-[13px] font-medium text-fg transition-colors hover:bg-hover', on ? 'border-accent/50' : 'border-line')}>
                <Icon size={16} className={tone} aria-hidden />
                <span className="flex-1">{alertLabel[kind]}</span>
                <span className={cn('flex size-4 items-center justify-center rounded-[5px]', on ? 'bg-accent text-accent-fg' : 'border-[1.5px] border-fg-disabled')}>
                  {on && <Check size={11} strokeWidth={3.4} />}
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-fg-muted">{s.alertsHint}</p>
      </div>
    </SettingsCard>
  )
}
