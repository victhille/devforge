import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Database, Info, Palette, RefreshCw, Search, Server, SlidersHorizontal, Bot, type LucideIcon } from 'lucide-react'
import type { AppSettings, DefaultIDE, PackageManager, Theme, AppLanguage, MotionSetting, Density } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { applyAppearance } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Switch from '@renderer/components/ui/Switch'
import { Input } from '@renderer/components/ui/Input'
import { Page } from '@renderer/components/ui/Page'
import AssistantSettings from './AssistantSettings'
import ServerSettings from './ServerSettings'
import DataSettings from './DataSettings'
import UpdatesSettings from './UpdatesRow'
import ReleaseNotes from './ReleaseNotes'
import LauncherSettings from './LauncherSettings'
import { Segmented, SettingRow, SettingsCard } from './parts'

type Section = 'general' | 'appearance' | 'forgy' | 'servers' | 'data' | 'updates' | 'about'
const SECTIONS: { id: Section; icon: LucideIcon; words: string }[] = [
  { id: 'general', icon: SlidersHorizontal, words: 'dossier folder projets projects paquets package npm pnpm yarn éditeur editor ide vs code windows démarrer start barre tray lanceur launcher raccourci shortcut raycast' },
  { id: 'appearance', icon: Palette, words: 'thème theme sombre dark clair light langue language anglais english français animations motion densité density compact compacte' },
  { id: 'forgy', icon: Bot, words: 'assistant clé key api modèle model effort budget actions widget raccourci shortcut promène walk boulon' },
  { id: 'servers', icon: Server, words: 'surveillance watch vps ssh alertes alerts disque disk conteneur container notifications site' },
  { id: 'data', icon: Database, words: 'données data sauvegardes backups restaurer restore journal log diagnostic rapport report dossier effacer clear historique history' },
  { id: 'updates', icon: RefreshCw, words: 'mise à jour update version bêta beta canal channel nouveautés notes quoi de neuf what new' },
  { id: 'about', icon: Info, words: 'version commit github licences problème issue' }
]

/** Small previews of the three themes */
const THEMES: { id: Theme; bg: string; side: string; card: string; ink: string; line: string }[] = [
  { id: 'dark', bg: '#0D0F13', side: '#0A0C10', card: '#161A21', ink: '#E8ECF2', line: '#2B323D' },
  { id: 'light', bg: '#F6F7F9', side: '#ECEEF2', card: '#FFFFFF', ink: '#1A1F27', line: '#C9D1DC' },
  { id: 'system', bg: 'linear-gradient(90deg,#0D0F13 50%,#F6F7F9 50%)', side: '#0A0C10', card: '#2B323D', ink: '#9AA4B2', line: '#2B323D' }
]

export default function SettingsPage() {
  const { t, setLang } = useI18n()
  const s = t.settings
  const toast = useToast()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [savedAt, setSavedAt] = useState(0)
  const [query, setQuery] = useState('')
  const [params, setParams] = useSearchParams()
  const notes = params.get('notes')
  const asked = params.get('section')
  const dirRef = useRef<string>('')

  useEffect(() => { window.devforge.getSettings().then(v => { setSettings(v); dirRef.current = v.defaultProjectsDir }) }, [])

  // "Saved" shows for two seconds after each change
  const [savedVisible, setSavedVisible] = useState(false)
  useEffect(() => {
    if (!savedAt) return
    setSavedVisible(true)
    const id = setTimeout(() => setSavedVisible(false), 2000)
    return () => clearTimeout(id)
  }, [savedAt])
  const onSaved = () => setSavedAt(Date.now())

  /** Every change is saved at once (the projects folder: when the field loses focus) */
  async function set<K extends keyof AppSettings>(key: K, value: AppSettings[K], persist = true) {
    if (!settings) return
    const next = { ...settings, [key]: value }
    setSettings(next)
    if (!persist) return
    await window.devforge.saveSettings(next)
    if (key === 'language') setLang(value as AppLanguage)
    if (key === 'theme' || key === 'motion' || key === 'density') applyAppearance(next)
    onSaved()
  }

  /** Several keys at once (one save, from the latest values) */
  async function update(patch: Partial<AppSettings>) {
    if (!settings) return
    const next = { ...settings, ...patch }
    setSettings(next)
    await window.devforge.saveSettings(next)
    onSaved()
  }

  async function copyReport() {
    const report = [`DevForge v${__APP_VERSION__} (${__APP_COMMIT__}, ${__BUILD_DATE__})`, await window.devforge.getReport()].join('\n')
    await navigator.clipboard.writeText(report)
    toast.show({ tone: 'success', title: s.reportCopied })
  }

  async function browseProjDir() {
    const dir = await window.devforge.selectDirectory()
    if (dir) set('defaultProjectsDir', dir)
  }

  const q = query.trim().toLowerCase()
  const shown = SECTIONS.filter(x => !q || `${s.nav[x.id]} ${x.words}`.toLowerCase().includes(q))
  const section: Section | null = shown.find(x => x.id === asked)?.id ?? shown[0]?.id ?? null
  const go = (id: Section) => setParams({ section: id }, { replace: true })

  if (!settings) return <Page><p className="text-fg-muted">{t.common.loading}</p></Page>

  if (notes) return <Page><ReleaseNotes focus={notes === 'all' ? null : notes} onBack={() => setParams({ section: 'updates' }, { replace: true })} /></Page>

  return (
    <Page className="gap-[22px]">
      <div className="df-rise flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[26px] font-semibold tracking-tight text-fg">{s.title}</h1>
          <p className="mt-1 text-[13px] text-fg-secondary">{s.subtitle}</p>
        </div>
        <span aria-live="polite" className={cn('flex h-[30px] items-center gap-1.5 rounded-full bg-success-soft px-3 text-xs font-medium text-success transition-opacity duration-300', savedVisible ? 'opacity-100' : 'opacity-0')}>
          <Check size={13} strokeWidth={2.6} /> {s.autoSaved}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <nav aria-label={s.title} className="df-rise flex max-w-[240px] flex-[1_1_210px] flex-col gap-0.5">
          <label className="mb-2.5 flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-canvas px-2.5 text-fg-muted focus-within:border-accent">
            <Search size={14} aria-hidden />
            <span className="sr-only">{s.searchPlaceholder}</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={s.searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-muted" />
          </label>
          {shown.map(x => (
            <button key={x.id} onClick={() => go(x.id)} aria-current={section === x.id ? 'page' : undefined}
              className={cn('flex h-9 items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] font-medium transition-colors',
                section === x.id ? 'bg-accent-soft text-fg' : 'text-fg-secondary hover:bg-surface hover:text-fg')}>
              <x.icon size={16} aria-hidden />
              <span className="flex-1">{s.nav[x.id]}</span>
            </button>
          ))}
          {!shown.length && <p className="mx-2.5 my-1.5 text-[12.5px] text-fg-muted">{s.noMatch}</p>}
        </nav>

        <section key={section ?? 'none'} className="flex min-w-0 max-w-[860px] flex-[999_1_520px] flex-col gap-[18px]">
          {section === 'general' && (
            <SettingsCard title={s.nav.general} hint={s.generalHint}>
              <SettingRow label={s.defaultDir} hint={s.defaultDirHint}>
                <div className="flex flex-[1_1_320px] gap-2">
                  <Input value={settings.defaultProjectsDir} aria-label={s.defaultDir} className="font-mono text-[12.5px]"
                    onChange={e => set('defaultProjectsDir', e.target.value, false)}
                    onBlur={() => { if (settings.defaultProjectsDir !== dirRef.current) { dirRef.current = settings.defaultProjectsDir; set('defaultProjectsDir', settings.defaultProjectsDir) } }} />
                  <Button variant="secondary" onClick={browseProjDir}>{s.browse}</Button>
                </div>
              </SettingRow>
              <SettingRow label={s.defaultPM} hint={s.defaultPMHint}>
                <Segmented<PackageManager> label={s.defaultPM} mono value={settings.defaultPackageManager} onChange={v => set('defaultPackageManager', v)}
                  items={(['npm', 'pnpm', 'yarn'] as const).map(pm => ({ value: pm, label: pm }))} />
              </SettingRow>
              <SettingRow label={s.defaultIDE} hint={s.defaultIDEHint}>
                <Segmented<DefaultIDE> label={s.defaultIDE} value={settings.defaultIDE} onChange={v => set('defaultIDE', v)}
                  items={[{ value: 'vscode', label: 'VS Code' }, { value: 'phpstorm', label: 'PhpStorm' }, { value: 'webstorm', label: 'WebStorm' }, { value: 'none', label: s.ideNone }]} />
              </SettingRow>
              <SettingRow label={s.startWithWindows} hint={s.startWithWindowsHint}>
                <Switch checked={settings.startWithWindows} onChange={v => set('startWithWindows', v)} label={s.startWithWindows} />
              </SettingRow>
              <SettingRow label={s.minimizeToTray} hint={s.minimizeToTrayHint}>
                <Switch checked={settings.minimizeToTray} onChange={v => set('minimizeToTray', v)} label={s.minimizeToTray} />
              </SettingRow>
            </SettingsCard>
          )}
          {section === 'general' && <LauncherSettings settings={settings} update={update} />}

          {section === 'appearance' && (
            <SettingsCard title={s.nav.appearance} hint={s.appearanceHint}>
              <div className="px-5 pt-1 pb-[18px]">
                <div className="mb-2.5 text-[13.5px] font-medium text-fg">{s.theme}</div>
                <div role="radiogroup" aria-label={s.theme} className="grid grid-cols-3 gap-3">
                  {THEMES.map(th => {
                    const on = settings.theme === th.id
                    return (
                      <button key={th.id} type="button" role="radio" aria-checked={on} onClick={() => set('theme', th.id)}
                        className={cn('flex flex-col gap-2.5 rounded-xl border-2 bg-canvas p-2.5 text-left transition-[border-color,transform] hover:-translate-y-0.5', on ? 'border-accent' : 'border-line')}>
                        <div aria-hidden className="flex h-[86px] overflow-hidden rounded-lg" style={{ background: th.bg }}>
                          <div className="flex w-[26%] flex-col gap-[5px] px-1.5 py-2" style={{ background: th.side }}>
                            <span className="h-[5px] rounded-[3px]" style={{ background: th.line }} />
                            <span className="h-[5px] w-[70%] rounded-[3px]" style={{ background: th.line }} />
                            <span className="h-[5px] w-[80%] rounded-[3px] bg-[#5B9BFF]" />
                          </div>
                          <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                            <span className="h-[7px] w-1/2 rounded-[3px]" style={{ background: th.ink }} />
                            <span className="flex-1 rounded-md" style={{ background: th.card }} />
                          </div>
                        </div>
                        <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                          <span className={cn('size-3.5 rounded-full', on ? 'border-[5px] border-accent' : 'border-[1.5px] border-fg-disabled')} />
                          {th.id === 'dark' ? s.themeDark : th.id === 'light' ? s.themeLight : s.themeAuto}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <SettingRow label={s.language} hint={s.languageHint}>
                <Segmented<AppLanguage> label={s.language} value={settings.language} onChange={v => set('language', v)}
                  items={[{ value: 'fr', label: 'Français' }, { value: 'en', label: 'English' }]} />
              </SettingRow>
              <SettingRow label={s.density} hint={s.densityHint}>
                <Segmented<Density> label={s.density} value={settings.density ?? 'comfortable'} onChange={v => set('density', v)}
                  items={[{ value: 'comfortable', label: s.densityComfortable }, { value: 'compact', label: s.densityCompact }]} />
              </SettingRow>
              <SettingRow label={s.motion} hint={s.motionHint}>
                <Segmented<MotionSetting> label={s.motion} value={settings.motion ?? 'system'} onChange={v => set('motion', v)}
                  items={[{ value: 'full', label: s.motionFull }, { value: 'reduced', label: s.motionReduced }, { value: 'system', label: s.motionSystem }]} />
              </SettingRow>
            </SettingsCard>
          )}

          {section === 'forgy' && <AssistantSettings onSaved={onSaved} settings={settings} set={set} />}
          {section === 'servers' && <ServerSettings onSaved={onSaved} />}
          {section === 'data' && <DataSettings onCopyReport={copyReport} />}
          {section === 'updates' && <UpdatesSettings settings={settings} set={set} onNotes={() => setParams({ notes: 'all' }, { replace: true })} />}

          {section === 'about' && (
            <SettingsCard title={s.nav.about}>
              <dl className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] border-t border-line-subtle">
                {[[s.version, `${__APP_VERSION__} · ${settings.updateChannel === 'beta' ? s.channelBeta : s.channelStable}`], [s.commit, __APP_COMMIT__],
                  [s.builtOnLabel, new Date(__BUILD_DATE__).toLocaleDateString()], ['Electron', navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] ?? '—']].map(([k, v]) => (
                  <div key={k} className="px-5 py-3.5">
                    <dt className="font-mono text-[10.5px] font-medium tracking-[.08em] text-fg-muted uppercase">{k}</dt>
                    <dd className="mt-1 font-mono text-[13px] font-medium text-fg">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-line-subtle px-5 py-4">
                <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal('https://github.com/victhille/devforge')}>{s.githubPage}</Button>
                <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal('https://github.com/victhille/devforge/issues/new')}>{s.reportIssue}</Button>
                <Button size="sm" variant="secondary" onClick={() => setParams({ notes: 'all' }, { replace: true })}>{s.releaseNotes}</Button>
                <Button size="sm" variant="secondary" onClick={copyReport}>{s.copyReport}</Button>
              </div>
            </SettingsCard>
          )}
        </section>
      </div>
    </Page>
  )
}
