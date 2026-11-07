import { useEffect, useState } from 'react'
import { Check, KeyRound } from 'lucide-react'
import type { AppSettings, AssistantActionMode, AssistantConfig, AssistantEffort, AssistantModel, AssistantProvider, AssistantUsage, DictationStatus } from '@shared/types'
import { PROVIDERS, providerInfo } from '@shared/data/assistantProviders'
import { providerLabel } from '@renderer/features/assistant/providerLabel'
import { errorText } from '@renderer/lib/errors'
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
  // v4.2: another provider's address and model, and the models it offers
  const [url, setUrl] = useState('')
  const [model, setModel] = useState('')
  const [models, setModels] = useState<string[] | null>(null)
  const [modelsError, setModelsError] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const [urlError, setUrlError] = useState('')
  useEffect(() => { setUrl(config?.baseUrl ?? ''); setModel(config?.providerModel ?? '') }, [config?.provider, config?.baseUrl, config?.providerModel])

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
  const info = providerInfo(config.provider)
  /** The models the provider offers, read with its key */
  async function loadModels() {
    setLoadingModels(true)
    setModelsError('')
    try { setModels(await window.devforge.assistant.models(config!.provider)) } catch (err) { setModels(null); setModelsError(errorText(err)) } finally { setLoadingModels(false) }
  }

  return (
    <SettingsCard title="Forgy" hint={s.forgyHint}
      icon={<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-forgy-soft"><Mascot mood="idle" size={32} followCursor={false} /></div>}>
      <SettingRow label={a.provider} hint={a.providerHint}>
        <select aria-label={a.provider} value={config.provider} className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-fg outline-none focus:border-accent"
          onChange={ev => { setModels(null); setModelsError(''); void save({ provider: ev.target.value as AssistantProvider }) }}>
          {PROVIDERS.map(p => <option key={p.id} value={p.id}>{providerLabel(p.id, t)}{config.keys[p.id] ? ' ✓' : ''}</option>)}
        </select>
      </SettingRow>
      {info.editableUrl && (
        <SettingRow label={a.baseUrl} hint={info.baseUrl ? a.baseUrlHint.replace('{url}', info.baseUrl) : a.baseUrlCustomHint}>
          <form className="flex flex-[1_1_320px] flex-wrap gap-2" onSubmit={async ev => {
            ev.preventDefault()
            // A refused address is said here (the main process gives a code)
            try { await save({ baseUrl: url }); setUrlError('') } catch (err) { const code = errorText(err); setUrlError((a.urlErrors as Record<string, string>)[code] ?? code) }
          }}>
            <Input value={url} onChange={ev => { setUrl(ev.target.value); setUrlError('') }} placeholder={info.baseUrl || 'http://localhost:8000/v1'} className="flex-1 font-mono" aria-label={a.baseUrl} spellCheck={false}
              aria-invalid={urlError ? true : undefined} />
            <Button type="submit" variant="secondary" disabled={url.trim().replace(/\/+$/, '') === config.baseUrl}>{a.saveUrl}</Button>
            {urlError && <span role="alert" className="w-full text-xs text-danger">{urlError}</span>}
          </form>
        </SettingRow>
      )}
      {info.id === 'ollama' ? (
        <SettingRow label={a.apiKey} hint={a.noKeyNeeded}><span /></SettingRow>
      ) : (
        <SettingRow label={`${a.apiKey} · ${providerLabel(info.id, t)}`} hint={info.needsKey ? a.apiKeyHint : `${a.apiKeyHint} ${a.keyOptional}`}>
          {config.keySource === 'saved' ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-success-soft px-2.5 py-1.5 font-mono text-xs text-success"><Check size={13} /> {a.apiKeySaved}</span>
              <Button size="sm" variant="danger" onClick={() => save({ clearKey: true, keyFor: config.provider })}>{a.removeKey}</Button>
            </div>
          ) : (
            <div className="flex flex-[1_1_320px] flex-wrap gap-2">
              {config.keySource === 'env' && <span className="flex w-full items-center gap-1.5 text-xs text-success"><Check size={13} /> {a.apiKeyFromEnv.replace('{env}', info.env.join(' / '))}</span>}
              <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={info.placeholder} className="font-mono" autoComplete="off" aria-label={`${a.apiKey} · ${providerLabel(info.id, t)}`} />
              <Button disabled={!key.trim()} onClick={async () => { await save({ apiKey: key, keyFor: config.provider }); setKey('') }}><KeyRound size={14} /> {a.saveKey}</Button>
            </div>
          )}
        </SettingRow>
      )}
      {config.provider === 'anthropic' ? <>
        <SettingRow label={a.model} hint={a.modelHint}>
          <Segmented<AssistantModel | 'auto'> label={a.model} value={config.model} onChange={m => save({ model: m })}
            items={[{ value: 'auto', label: 'Auto' }, { value: 'claude-haiku-5-5', label: 'Haiku' }, { value: 'claude-sonnet-5-5', label: 'Sonnet' }, { value: 'claude-opus-5-5', label: 'Opus' }]} />
        </SettingRow>
        <SettingRow label={a.effort}>
          <Segmented<AssistantEffort | 'auto'> label={a.effort} value={config.effort} onChange={effort => save({ effort })}
            items={[{ value: 'auto', label: a.effortAuto }, { value: 'low', label: a.effortLow }, { value: 'medium', label: a.effortMedium }, { value: 'high', label: a.effortHigh }]} />
        </SettingRow>
      </> : (
        <SettingRow label={a.providerModel} hint={a.providerModelHint}>
          <div className="flex flex-[1_1_320px] flex-col gap-1.5">
            <div className="flex gap-2">
              <Input list="forgy-models" value={model} spellCheck={false} className="font-mono" aria-label={a.providerModel}
                onChange={ev => { setModel(ev.target.value); if (models?.includes(ev.target.value)) void save({ providerModel: ev.target.value }) }}
                onBlur={() => { if (model.trim() !== config.providerModel) void save({ providerModel: model }) }}
                onKeyDown={ev => { if (ev.key === 'Enter') void save({ providerModel: model }) }} />
              <Button variant="secondary" disabled={!config.hasKey} loading={loadingModels} onClick={loadModels}>{a.loadModels}</Button>
            </div>
            <datalist id="forgy-models">{models?.map(m => <option key={m} value={m} />)}</datalist>
            {models && <span className="text-xs text-fg-muted" role="status">{a.modelsLoaded.replace('{n}', String(models.length))}</span>}
            {modelsError && <span className="text-xs text-danger" role="alert">{a.modelsFailed.replace('{error}', modelsError)}</span>}
          </div>
        </SettingRow>
      )}
      <SettingRow label={a.actionMode} hint={a.actionModeHint}>
        <Segmented<AssistantActionMode> label={a.actionMode} value={config.actionMode} onChange={actionMode => save({ actionMode })}
          items={[{ value: 'ask', label: a.actionModeAsk }, { value: 'auto-safe', label: a.actionModeAuto }]} />
      </SettingRow>
      <SettingRow label={a.budget} hint={config.provider === 'anthropic' ? a.budgetHint : `${a.budgetHint} ${a.budgetOther}`}>
        <div className="flex flex-[0_1_320px] flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={1} value={budget} onChange={e => setBudget(e.target.value)} aria-label={a.budget}
              onBlur={() => { const n = Number(budget); if (Number.isFinite(n) && n >= 0 && n !== config.monthlyBudget) save({ monthlyBudget: n }) }}
              className="w-24 font-mono" />
            <span className="text-sm text-fg-muted">$ / {a.month.toLowerCase()}</span>
            {usage && <span className="ml-auto text-sm text-fg-secondary">{a.spentThisMonth.replace('{n}', usage.spent.toFixed(2))}</span>}
          </div>
          <div role="img" aria-label={`${Math.round(spentPct)} %`} className="h-1.5 overflow-hidden rounded-full bg-active">
            <div className={spentPct >= 90 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-accent'} style={{ width: `${spentPct}%` }} />
          </div>
        </div>
      </SettingRow>
      <SettingRow label={a.walker} hint={a.walkerHint}>
        <div className="flex items-center gap-5">
          <label className={walker ? 'flex items-center gap-2 text-sm text-fg-secondary' : 'pointer-events-none flex items-center gap-2 text-sm text-fg-secondary opacity-40'}>
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
