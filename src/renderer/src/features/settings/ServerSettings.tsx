import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import type { AlertKind, SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Checkbox from '@renderer/components/ui/Checkbox'
import Notice from '@renderer/components/ui/Notice'
import Range from '@renderer/components/ui/Range'
import Switch from '@renderer/components/ui/Switch'
import { useWatch } from '@renderer/hooks/useWatch'
import { SettingRow, SettingsCard, Words } from './parts'

const ALERTS: AlertKind[] = ['disk', 'container', 'server', 'site']

/** Background watch: which servers, the disk threshold, then which alerts notify */
export default function ServerSettings({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n()
  const s = t.settings
  const w = t.watch
  const navigate = useNavigate()
  const { config, saveConfig } = useWatch()
  const [connections, setConnections] = useState<SSHConnection[]>([])
  useEffect(() => { window.devforge.getSshConnections().then(setConnections).catch(() => {}) }, [])
  if (!config) return null

  const save = async (u: Parameters<typeof saveConfig>[0]) => { await saveConfig(u); onSaved() }
  const alertLabel: Record<AlertKind, string> = { disk: s.alertDisk, container: s.alertContainer, server: s.alertServer, site: s.alertSite }

  return (
    <>
      <SettingsCard title={s.groups.servers} action={<Button size="sm" variant="ghost" onClick={() => navigate('/monitor')}>{s.seeCurves}</Button>}>
        <SettingRow label={s.watchedServers} hint={s.watchedServersHint}>
          {connections.length === 0 ? <p className="text-sm text-fg-muted">{w.noServers}</p> : (
            <div role="group" aria-label={s.watchedServers} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {connections.map(c => {
                const on = config.watched.includes(c.id)
                return (
                  <Checkbox key={c.id} checked={on} className="text-sm"
                    onChange={v => save({ watched: v ? [...config.watched, c.id] : config.watched.filter(x => x !== c.id) })}>
                    <span className={on ? 'font-mono font-medium text-fg' : 'font-mono'}>{c.name}</span>
                  </Checkbox>
                )
              })}
            </div>
          )}
        </SettingRow>
        <SettingRow label={s.diskThreshold} hint={s.diskAlertHint}>
          <Range className="w-64" label={s.diskThreshold} min={50} max={95} step={5} unit="%" value={config.diskAlert} onChange={v => save({ diskAlert: v })} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={s.notifyWhen} icon={<Bell size={16} className="text-accent" aria-hidden />}>
        <div className="border-t border-line-subtle px-5 pt-1 pb-2">
          {ALERTS.map(kind => (
            <div key={kind} className="flex items-center gap-3 py-2.5 not-first:border-t not-first:border-line-subtle">
              <span className="flex-1 text-base font-medium text-fg">{alertLabel[kind]}</span>
              <Switch checked={config.alerts[kind]} label={alertLabel[kind]} onChange={v => save({ alerts: { ...config.alerts, [kind]: v } })} />
            </div>
          ))}
        </div>
        <Notice className="mx-5 mb-4.5"><Words text={s.alertsHint} parts={{ widget: <button type="button" onClick={() => navigate('/settings?section=forgy')} className="text-accent hover:underline">{s.widgetLink}</button> }} /></Notice>
      </SettingsCard>
    </>
  )
}
