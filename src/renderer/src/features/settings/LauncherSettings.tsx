import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Switch from '@renderer/components/ui/Switch'
import { SettingRow, SettingsCard } from './parts'

const MODIFIERS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph'])

/** A key press as an Electron accelerator ("CommandOrControl+Alt+Space"), null while incomplete */
export function toAccelerator(e: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'key' | 'code'>): string | null {
  if (MODIFIERS.has(e.key)) return null
  const mods = [e.ctrlKey && 'CommandOrControl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean) as string[]
  // At least Ctrl, Alt or Win: a bare letter would be stolen from every application
  if (!mods.some(m => m !== 'Shift')) return null
  const code = e.code
  const key = code === 'Space' ? 'Space'
    : /^Key[A-Z]$/.test(code) ? code.slice(3)
    : /^Digit\d$/.test(code) ? code.slice(5)
    : /^F([1-9]|1[0-9]|2[0-4])$/.test(code) ? code
    : ({ Enter: 'Enter', Backquote: '`', Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=' } as Record<string, string>)[code]
  return key ? [...mods, key].join('+') : null
}

export const showAccelerator = (a: string) => a.replace('CommandOrControl', 'Ctrl').replace('Super', 'Win').replace(/\+/g, ' + ')

export default function LauncherSettings({ settings, update }: { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> }) {
  const { t } = useI18n()
  const s = t.settings
  const [recording, setRecording] = useState(false)
  const [taken, setTaken] = useState(false)

  // Whether the shortcut was free, after each change
  useEffect(() => {
    let alive = true
    const id = setTimeout(() => window.devforge.launcher.state().then(st => { if (alive) setTaken(st.taken) }).catch(() => {}), 150)
    return () => { alive = false; clearTimeout(id) }
  }, [settings.launcherEnabled, settings.launcherShortcut])

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') { setRecording(false); return }
      const accel = toAccelerator(e)
      if (accel) { setRecording(false); update({ launcherShortcut: accel }) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, update])

  const alwaysReady = settings.startWithWindows && settings.minimizeToTray

  return (
    <SettingsCard title={s.launcherTitle} hint={s.launcherHint}>
      <SettingRow label={s.launcherEnabled} hint={s.launcherEnabledHint}>
        <Switch checked={settings.launcherEnabled} onChange={v => update({ launcherEnabled: v })} label={s.launcherEnabled} />
      </SettingRow>
      {settings.launcherEnabled && (
        <>
          <SettingRow label={s.launcherShortcut} hint={taken ? <span className="text-warning">{s.launcherTaken}</span> : s.launcherShortcutHint}>
            <div className="flex items-center gap-2">
              <kbd className="rounded-md border border-line bg-canvas px-2 py-1 font-mono text-[12.5px] text-fg">
                {recording ? s.launcherPress : showAccelerator(settings.launcherShortcut)}
              </kbd>
              <Button size="sm" variant="secondary" onClick={() => setRecording(r => !r)}>{recording ? t.common.cancel : s.launcherChange}</Button>
            </div>
          </SettingRow>
          {!alwaysReady && (
            <div className="mx-5 mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-accent-soft p-3">
              <p className="min-w-[220px] flex-1 text-[13px] text-fg">{s.launcherStartup}</p>
              <Button size="sm" onClick={() => update({ startWithWindows: true, minimizeToTray: true })}>{s.launcherStartupYes}</Button>
            </div>
          )}
        </>
      )}
    </SettingsCard>
  )
}
