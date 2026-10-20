import { useEffect, useState } from 'react'
import { Check, KeyRound } from 'lucide-react'
import type { AppSettings, AssistantActionMode, AssistantConfig, AssistantEffort, AssistantModel, AssistantUsage, DictationStatus } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import Switch from '@renderer/components/ui/Switch'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'
import Mascot from '@renderer/features/assistant/Mascot'
import { formatSize } from '@renderer/lib/format'
import { Segmented, SettingRow, SettingsCard } from './parts'

/** Whisper model for voice typing: choice, download, removal */
function DictationRow({ settings, set }: { settings: AppSettings; set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => Promise<void> }) {
  const { t } = useI18n()
  const d = t.dictation
  const [status, setStatus] = useState<DictationStatus | null>(null)
  const [pct, setPct] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const model = settings.dictationModel ?? 'base'
  useEffect(() => { window.devforge.dictation.status().then(setStatus).catch(() => {}) }, [model])
  useEffect(() => window.devforge.dictation.onProgress(p => setPct(p.total ? Math.round((p.loaded / p.total) * 100) : null)), [])

  return (
    <SettingRow label={d.setting} hint={<>{d.settingHint}<br /><span className="font-mono text-xs">
      {busy ? (pct === null ? d.downloadingNoPct : d.downloading.replace('{p}', String(pct))) : status?.downloaded ? d.downloaded.replace('{size}', formatSize(status.size)) : d.notDownloaded}
    </span></>}>
      <div className="flex flex-col items-end gap-2">
        <Segmented<'base' | 'small'> label={d.setting} value={model} onChange={v => set('dictationModel', v)}
          items={[{ value: 'base', label: d.modelBase }, { value: 'small', label: d.modelSmall }]} />
        {status && (status.downloaded
          ? <Button size="sm" variant="ghost" onClick={async () => setStatus(await window.devforge.dictation.remove())}>{d.removeModel}</Button>
          : <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); try { setStatus(await window.devforge.dictation.prepare()) } finally { setBusy(false); setPct(null) } }}>{d.download}</Button>)}
      </div>
    </SettingRow>
  )
}

/** Forgy: key, model, actions, budget, walker and widget (saved apart: the key never goes through settings.json) */
export default function AssistantSettings({ onSaved, settings, set }: { onSaved: () => void; settings: AppSettings; set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => Promise<void> }) {
  const { t } = useI18n()
  const a = t.assistant
  const s = t.settings
  const [config, setConfig] = useState<AssistantConfig | null>(null)
  const [key, setKey] = useState('')
  const [usage, setUsage] = useState<AssistantUsage | null>(null)
  const [budget, setBudget] = useState('')
  const [shortcut, setShortcut] = useState<string | null>(null)
  const { walker, setWalker, walkerDog, setWalkerDog } = useAssistant()

  // The widget's global shortcut, once it is on (another app may own the first choice)
  const widgetOn = !!config?.desktopWidget
  useEffect(() => { if (widgetOn) window.devforge.widget.shortcut().then(setShortcut) }, [widgetOn])

  useEffect(() => {
    window.devforge.assistant.getConfig().then(c => { setConfig(c); setBudget(String(c.monthlyBudget)) })
    window.devforge.assistant.usage().then(setUsage)
  }, [])
  if (!config) return null

  const save = async (u: Parameters<typeof window.devforge.assistant.saveConfig>[0]) => {
    setConfig(await window.devforge.assistant.saveConfig(u))
    onSaved()
  }
  const spentPct = usage && config.monthlyBudget > 0 ? Math.min(100, (usage.spent / config.monthlyBudget) * 100) : 0

  return (
    <SettingsCard title="Forgy" hint={s.forgyHint}
      icon={<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-forgy-soft"><Mascot mood="idle" size={32} followCursor={false} /></div>}>
      <SettingRow label={a.apiKey} hint={a.apiKeyHint}>
        {config.hasKey ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 font-mono text-xs text-success"><Check size={13} /> {a.apiKeySaved}</span>
            <Button size="sm" variant="danger" onClick={() => save({ clearKey: true })}>{a.removeKey}</Button>
          </div>
        ) : (
          <div className="flex flex-[1_1_320px] gap-2">
            <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={a.apiKeyPlaceholder} className="font-mono" autoComplete="off" aria-label={a.apiKey} />
            <Button disabled={!key.trim()} onClick={async () => { await save({ apiKey: key }); setKey('') }}><KeyRound size={14} /> {a.saveKey}</Button>
          </div>
        )}
      </SettingRow>
      <SettingRow label={a.model} hint={a.modelHint}>
        <Segmented<AssistantModel | 'auto'> label={a.model} value={config.model} onChange={model => save({ model })}
          items={[{ value: 'auto', label: 'Auto' }, { value: 'claude-haiku-5-5', label: 'Haiku' }, { value: 'claude-sonnet-5-5', label: 'Sonnet' }, { value: 'claude-opus-5-5', label: 'Opus' }]} />
      </SettingRow>
      <SettingRow label={a.effort}>
        <Segmented<AssistantEffort | 'auto'> label={a.effort} value={config.effort} onChange={effort => save({ effort })}
          items={[{ value: 'auto', label: a.effortAuto }, { value: 'low', label: a.effortLow }, { value: 'medium', label: a.effortMedium }, { value: 'high', label: a.effortHigh }]} />
      </SettingRow>
      <SettingRow label={a.actionMode} hint={a.actionModeHint}>
        <Segmented<AssistantActionMode> label={a.actionMode} value={config.actionMode} onChange={actionMode => save({ actionMode })}
          items={[{ value: 'ask', label: a.actionModeAsk }, { value: 'auto-safe', label: a.actionModeAuto }]} />
      </SettingRow>
      <SettingRow label={a.budget} hint={a.budgetHint}>
        <div className="flex flex-[0_1_320px] flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={1} value={budget} onChange={e => setBudget(e.target.value)} aria-label={a.budget}
              onBlur={() => { const n = Number(budget); if (Number.isFinite(n) && n >= 0 && n !== config.monthlyBudget) save({ monthlyBudget: n }) }}
              className="w-24 font-mono" />
            <span className="text-sm text-fg-muted">$ / {a.month.toLowerCase()}</span>
            {usage && <span className="ml-auto text-[12.5px] text-fg-secondary">{a.spentThisMonth.replace('{n}', usage.spent.toFixed(2))}</span>}
          </div>
          <div role="img" aria-label={`${Math.round(spentPct)} %`} className="h-1.5 overflow-hidden rounded-full bg-active">
            <div className={spentPct >= 90 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-accent'} style={{ width: `${spentPct}%` }} />
          </div>
        </div>
      </SettingRow>
      <SettingRow label={a.walker} hint={a.walkerHint}>
        <div className="flex items-center gap-5">
          <label className={walker ? 'flex items-center gap-2 text-[12.5px] text-fg-secondary' : 'pointer-events-none flex items-center gap-2 text-[12.5px] text-fg-secondary opacity-40'}>
            {a.walkerDog}<Switch checked={walkerDog && walker} onChange={setWalkerDog} label={a.walkerDog} />
          </label>
          <Switch checked={walker} onChange={setWalker} label={a.walker} />
        </div>
      </SettingRow>
      <DictationRow settings={settings} set={set} />
      <SettingRow label={a.widget.toggle} hint={<>{a.widget.toggleHint}{config.desktopWidget && <> {shortcut ? a.widget.shortcut.replace('{key}', shortcut) : a.widget.shortcutTaken}</>}</>}>
        <Switch checked={config.desktopWidget} onChange={desktopWidget => save({ desktopWidget })} label={a.widget.toggle} />
      </SettingRow>
    </SettingsCard>
  )
}
