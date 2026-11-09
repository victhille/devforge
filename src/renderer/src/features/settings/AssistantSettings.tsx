import { useEffect, useState } from 'react'
import { CardSkeleton, Skeleton } from '@renderer/components/ui/Skeleton'
import { Check, KeyRound, Lock, ShieldCheck, Trash2 } from 'lucide-react'
import type { AppSettings, AssistantActionMode, AssistantConfig, AssistantEffort, AssistantModel, AssistantProvider, AssistantUsage, ConnectionTest, DictationStatus } from '@shared/types'
import { PROVIDERS, providerInfo } from '@shared/data/assistantProviders'
import { providerLabel } from '@renderer/features/assistant/providerLabel'
import { errorText } from '@renderer/lib/errors'
import { useI18n } from '@renderer/i18n/I18nContext'
import Badge from '@renderer/components/ui/Badge'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
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
    <SettingRow label={d.setting} hint={status?.downloaded ? d.settingHint : (
      <>{d.settingHint} <span role="status" className="text-fg-muted">{busy ? (pct === null ? d.downloadingNoPct : d.downloading.replace('{p}', String(pct))) : d.notDownloaded}</span></>
    )}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Segmented<'base' | 'small'> label={d.setting} value={model} onChange={v => set('dictationModel', v)}
          items={[{ value: 'base', label: d.modelBase }, { value: 'small', label: d.modelSmall }]} />
        {status && (status.downloaded ? <>
          <span title={formatSize(status.size)}><Badge color="success" dot>{d.downloadedShort}</Badge></span>
          <IconButton size="sm" tone="danger" title={d.removeModel} onClick={async () => setStatus(await window.devforge.dictation.remove())}><Trash2 size={13} /></IconButton>
        </> : (
          <Button size="sm" variant="secondary" loading={busy} onClick={async () => { setBusy(true); try { setStatus(await window.devforge.dictation.prepare()) } finally { setBusy(false); setPct(null) } }}>{d.download}</Button>
        ))}
      </div>
    </SettingRow>
  )
}

const MODEL_NAMES: Record<string, string> = { 'claude-haiku-5-5': 'Haiku', 'claude-sonnet-5-5': 'Sonnet', 'claude-opus-5-5': 'Opus' }

/** Forgy: who answers and with what key, how it answers and what it costs, what it may do, where it shows (saved apart: the key never goes through settings.json) */
export default function AssistantSettings({ onSaved, settings, set }: { onSaved: () => void; settings: AppSettings; set: <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => Promise<void> }) {
  const { t, lang } = useI18n()
  const a = t.assistant
  const s = t.settings
  const c = s.connections
  const [replacing, setReplacing] = useState(false)
  const [tested, setTested] = useState<ConnectionTest | 'busy' | null>(null)
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
  if (!config) return <div role="status" aria-label={t.common.loading} className="flex flex-col gap-5"><Skeleton className="h-20 rounded-card" /><CardSkeleton label={false} rows={2} /><CardSkeleton label={false} rows={3} /></div>

  const save = async (u: Parameters<typeof window.devforge.assistant.saveConfig>[0]) => {
    setConfig(await window.devforge.assistant.saveConfig(u))
    onSaved()
  }
  const money = (n: number) => new Intl.NumberFormat(lang, { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: Number.isInteger(n) && n > 0 ? 0 : 2 }).format(n)
  const spentPct = usage && config.monthlyBudget > 0 ? Math.min(100, (usage.spent / config.monthlyBudget) * 100) : 0
  const info = providerInfo(config.provider)
  /** The models the provider offers, read with its key */
  async function test() {
    setTested('busy')
    setTested(await window.devforge.connections.test('forgy').catch(err => ({ ok: false, detail: errorText(err) })))
  }
  async function loadModels() {
    setLoadingModels(true)
    setModelsError('')
    try { setModels(await window.devforge.assistant.models(config!.provider)) } catch (err) { setModels(null); setModelsError(errorText(err)) } finally { setLoadingModels(false) }
  }

  const modelText = config.provider === 'anthropic'
    ? (config.model === 'auto' ? s.forgyAutoModel : s.forgyModel.replace('{model}', MODEL_NAMES[config.model] ?? config.model))
    : s.forgyModel.replace('{model}', config.providerModel || '—')

  return (
    <>
      <Card className="df-rise flex flex-wrap items-center gap-x-5 gap-y-3 border-accent/40 bg-accent-soft/40 px-5 py-4.5">
        <div aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-forgy-soft"><Mascot mood="idle" size={34} followCursor={false} /></div>
        <div className="min-w-[220px] flex-1">
          <h2 className="font-display text-md font-bold text-fg">{s.forgyAnswersWith.replace('{provider}', providerLabel(config.provider, t))}</h2>
          <p className="mt-0.5 text-sm text-fg-secondary">{modelText} · {config.actionMode === 'ask' ? s.forgyAsks : s.forgyActsSafe}</p>
        </div>
        {usage && (
          <div className="border-l border-accent/30 pl-5 text-right">
            <p className="text-xs text-fg-secondary">{s.thisMonth}</p>
            <p className="font-display text-xl font-bold text-fg">{money(usage.spent)}</p>
            <p className="text-xs text-fg-secondary">{config.monthlyBudget > 0 ? s.ofBudget.replace('{n}', money(config.monthlyBudget)) : s.noBudget}</p>
          </div>
        )}
      </Card>

      <SettingsCard title={s.groups.provider}>
        <SettingRow label={s.forgyWho} hint={a.providerHint}>
          <select aria-label={a.provider} value={config.provider} className="h-9 rounded-lg border border-line bg-canvas px-2.5 text-sm text-fg outline-none focus:border-accent"
            onChange={ev => { setModels(null); setModelsError(''); setTested(null); setReplacing(false); void save({ provider: ev.target.value as AssistantProvider }) }}>
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
          <SettingRow label={a.apiKey} hint={a.noKeyNeeded} />
        ) : (
          <SettingRow label={`${a.apiKey} · ${providerLabel(info.id, t)}`} hint={info.needsKey ? a.apiKeyHint : `${a.apiKeyHint} ${a.keyOptional}`}>
            <div className="flex flex-[0_1_420px] flex-col items-end gap-2">
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {tested === 'busy' ? <Spinner /> : tested && (
                  <span role="status"><Badge color={tested.ok ? 'success' : 'danger'} dot>{(tested.ok ? c.testOk : c.testFailed).replace('{detail}', (c.errors as Record<string, string>)[tested.detail] ?? tested.detail)}</Badge></span>
                )}
                {config.keySource === 'saved' && <Badge color="success"><Lock size={12} aria-hidden /> {c.keySaved}</Badge>}
                {config.keySource === 'env' && <span className="flex items-center gap-1.5 text-xs text-success"><Check size={13} aria-hidden /> {a.apiKeyFromEnv.replace('{env}', info.env.join(' / '))}</span>}
                {config.hasKey && <Button size="sm" variant="ghost" disabled={tested === 'busy'} onClick={test} aria-label={c.testOf.replace('{name}', providerLabel(info.id, t))}>{c.test}</Button>}
                {config.keySource === 'saved' && <>
                  <Button size="sm" variant="secondary" aria-expanded={replacing} onClick={() => setReplacing(r => !r)}>{s.replaceKey}</Button>
                  <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" onClick={() => { setTested(null); void save({ clearKey: true, keyFor: config.provider }) }}>{c.remove}</Button>
                </>}
              </div>
              {(config.keySource !== 'saved' || replacing) && (
                <form className="flex w-full flex-wrap gap-2" onSubmit={async e => { e.preventDefault(); await save({ apiKey: key, keyFor: config.provider }); setKey(''); setReplacing(false); setTested(null) }}>
                  <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={info.placeholder} className="min-w-48 flex-1 font-mono" autoComplete="off" autoFocus={replacing}
                    aria-label={`${a.apiKey} · ${providerLabel(info.id, t)}`} />
                  <Button type="submit" size="sm" disabled={!key.trim()}><KeyRound size={13} /> {a.saveKey}</Button>
                  {replacing && <Button type="button" size="sm" variant="ghost" onClick={() => { setReplacing(false); setKey('') }}>{t.common.cancel}</Button>}
                </form>
              )}
            </div>
          </SettingRow>
        )}
      </SettingsCard>

      <SettingsCard title={s.groups.answers}>
        {config.provider === 'anthropic' ? <>
          <SettingRow label={a.model} hint={a.modelHint}>
            <Segmented<AssistantModel | 'auto'> label={a.model} value={config.model} onChange={m => save({ model: m })}
              items={[{ value: 'auto', label: 'Auto' }, { value: 'claude-haiku-5-5', label: 'Haiku' }, { value: 'claude-sonnet-5-5', label: 'Sonnet' }, { value: 'claude-opus-5-5', label: 'Opus' }]} />
          </SettingRow>
          <SettingRow label={a.effort} hint={s.effortHint}>
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
        <SettingRow label={a.budget} hint={config.provider === 'anthropic' ? a.budgetHint : `${a.budgetHint} ${a.budgetOther}`}>
          <div className="flex flex-[0_1_320px] flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input type="number" min={0} step={1} value={budget} onChange={e => setBudget(e.target.value)} aria-label={a.budget}
                onBlur={() => { const n = Number(budget); if (Number.isFinite(n) && n >= 0 && n !== config.monthlyBudget) save({ monthlyBudget: n }) }}
                className="w-24 font-mono" />
              <span className="text-sm text-fg-muted">$ / {a.month.toLowerCase()}</span>
              {usage && <span className="ml-auto text-sm text-fg-secondary">{s.spent.replace('{n}', money(usage.spent))}</span>}
            </div>
            <div role="img" aria-label={`${Math.round(spentPct)} %`} className="h-1.5 overflow-hidden rounded-full bg-active">
              <div className={spentPct >= 90 ? 'h-full rounded-full bg-warning' : 'h-full rounded-full bg-accent'} style={{ width: `${spentPct}%` }} />
            </div>
          </div>
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={a.actionMode} icon={<ShieldCheck size={16} className="text-accent" aria-hidden />}>
        <SettingRow label={s.beforeActing} hint={a.actionModeHint}>
          <Segmented<AssistantActionMode> label={a.actionMode} value={config.actionMode} onChange={actionMode => save({ actionMode })}
            items={[{ value: 'ask', label: a.actionModeAsk }, { value: 'auto-safe', label: a.actionModeAuto }]} />
        </SettingRow>
      </SettingsCard>

      <SettingsCard title={s.groups.presence}>
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
    </>
  )
}
