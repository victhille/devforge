import { useEffect, useState } from 'react'
import type { AppSettings } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Kbd from '@renderer/components/ui/Kbd'
import Switch from '@renderer/components/ui/Switch'
import { SettingRow } from './parts'

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

/** Settings › General › Start-up and window: the global launcher, its shortcut key by key, changed by pressing a new one */
export default function LauncherRow({ settings, update }: { settings: AppSettings; update: (patch: Partial<AppSettings>) => Promise<void> }) {
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

  // « Space » in the interface's words
  const keys = showAccelerator(settings.launcherShortcut).split(' + ').map(k => (k === 'Space' ? s.keySpace : k))
  const on = settings.launcherEnabled

  return (
    <SettingRow label={s.launcherTitle} hint={on && taken ? <span className="text-warning">{s.launcherTaken}</span> : s.launcherHint}>
      <div className="flex flex-wrap items-center gap-2">
        {recording ? (
          <span role="status" className="text-sm text-fg-secondary">{s.launcherPress}</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="sr-only">{keys.join(' + ')}</span>
            {keys.map(k => <span key={k} aria-hidden><Kbd size="md">{k}</Kbd></span>)}
          </span>
        )}
        <Button size="sm" variant="ghost" disabled={!on} onClick={() => setRecording(r => !r)}>{recording ? t.common.cancel : s.launcherChange}</Button>
        <Switch checked={on} onChange={v => update({ launcherEnabled: v })} label={s.launcherEnabled} />
      </div>
    </SettingRow>
  )
}
