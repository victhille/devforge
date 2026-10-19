import { useEffect, useState } from 'react'
import { Check, KeyRound } from 'lucide-react'
import type { AssistantActionMode, AssistantConfig, AssistantEffort, AssistantModel, AssistantUsage } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Tabs from '@renderer/components/ui/Tabs'
import { Input, Select } from '@renderer/components/ui/Input'
import { SectionTitle } from '@renderer/components/ui/Page'
import Switch from '@renderer/components/ui/Switch'
import { useAssistant } from '@renderer/features/assistant/AssistantContext'

/** Saved on change, apart from the page's "Save" button: the key never goes through the settings file */
export default function AssistantSettings() {
  const { t } = useI18n()
  const a = t.assistant
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

  const save = async (u: Parameters<typeof window.devforge.assistant.saveConfig>[0]) => setConfig(await window.devforge.assistant.saveConfig(u))

  return (
    <section id="assistant" className="flex flex-col gap-2.5">
      <SectionTitle>{a.sectionSettings}</SectionTitle>
      <Card className="divide-y divide-line-subtle">
        <div className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-medium uppercase tracking-wide text-fg-secondary">{a.apiKey}</span>
          {config.hasKey ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-sm text-success"><Check size={14} /> {a.apiKeySaved}</span>
              <Button size="sm" variant="ghost" onClick={() => save({ clearKey: true })}>{a.removeKey}</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={a.apiKeyPlaceholder} className="font-mono" autoComplete="off" />
              <Button disabled={!key.trim()} onClick={async () => { await save({ apiKey: key }); setKey('') }}><KeyRound size={14} /> {a.saveKey}</Button>
            </div>
          )}
          <span className="text-xs text-fg-muted">{a.apiKeyHint}</span>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-medium uppercase tracking-wide text-fg-secondary">{a.model}</span>
          <Select value={config.model} onChange={e => save({ model: e.target.value as AssistantModel | 'auto' })} className="w-96">
            <option value="auto">{a.modelAuto}</option>
            <option value="claude-opus-5-5">{a.modelOpus}</option>
            <option value="claude-sonnet-5-5">{a.modelSonnet}</option>
            <option value="claude-haiku-5-5">{a.modelHaiku}</option>
          </Select>
          <span className="text-xs text-fg-muted">{a.modelHint}</span>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-medium uppercase tracking-wide text-fg-secondary">{a.effort}</span>
          <Tabs<AssistantEffort | 'auto'>
            value={config.effort}
            onChange={effort => save({ effort })}
            items={[
              { value: 'auto', label: a.effortAuto },
              { value: 'low', label: a.effortLow },
              { value: 'medium', label: a.effortMedium },
              { value: 'high', label: a.effortHigh }
            ]}
          />
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-medium uppercase tracking-wide text-fg-secondary">{a.actionMode}</span>
          <Tabs<AssistantActionMode>
            value={config.actionMode}
            onChange={actionMode => save({ actionMode })}
            items={[{ value: 'ask', label: a.actionModeAsk }, { value: 'auto-safe', label: a.actionModeAuto }]}
          />
          <span className="text-xs text-fg-muted">{a.actionModeHint}</span>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-medium uppercase tracking-wide text-fg-secondary">{a.budget}</span>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={1} value={budget} onChange={e => setBudget(e.target.value)}
              onBlur={() => { const n = Number(budget); if (Number.isFinite(n) && n >= 0) save({ monthlyBudget: n }) }}
              className="w-28" />
            <span className="text-sm text-fg-muted">$ / {a.month.toLowerCase()}</span>
            {usage && <span className="ml-auto text-sm text-fg-secondary">{a.spentThisMonth.replace('{n}', usage.spent.toFixed(2))}</span>}
          </div>
          <span className="text-xs text-fg-muted">{a.budgetHint}</span>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <label className="flex items-center gap-3">
            <Switch checked={walker} onChange={setWalker} label={a.walker} />
            <span className="text-base text-fg">{a.walker}</span>
          </label>
          <label className="flex items-center gap-3 pl-12">
            <Switch checked={walkerDog && walker} onChange={setWalkerDog} label={a.walkerDog} className={walker ? '' : 'pointer-events-none opacity-40'} />
            <span className="text-base text-fg-secondary">{a.walkerDog}</span>
          </label>
          <span className="text-xs text-fg-muted">{a.walkerHint}</span>
        </div>
        <div className="flex flex-col gap-2 px-5 py-4">
          <label className="flex items-center gap-3">
            <Switch checked={config.desktopWidget} onChange={desktopWidget => save({ desktopWidget })} label={a.widget.toggle} />
            <span className="text-base text-fg">{a.widget.toggle}</span>
          </label>
          <span className="text-xs text-fg-muted">
            {a.widget.toggleHint}
            {config.desktopWidget && <> {shortcut ? a.widget.shortcut.replace('{key}', shortcut) : a.widget.shortcutTaken}</>}
          </span>
        </div>
      </Card>
    </section>
  )
}
