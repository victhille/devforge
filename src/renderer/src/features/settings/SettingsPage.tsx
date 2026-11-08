import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { AppSettings, PackageManager, Theme, AppLanguage, MotionSetting, Density } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { applyAppearance } from '@renderer/lib/appearance'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Switch from '@renderer/components/ui/Switch'
import { Page } from '@renderer/components/ui/Page'
import AssistantSettings from './AssistantSettings'
import ServerSettings from './ServerSettings'
import ConnectionsSettings from './ConnectionsSettings'
import DataSettings from './DataSettings'
import UpdatesSettings from './UpdatesRow'
import ReleaseNotes from './ReleaseNotes'
import LauncherSettings from './LauncherSettings'
import ProjectFolders from './ProjectFolders'
import IdeSettings from './IdeSettings'
import TemplatesSettings from './TemplatesSettings'
import { projectFolders } from '@shared/lib/projectFolders'
import { Segmented, SettingRow, SettingsCard } from './parts'
import SearchInput from '@renderer/components/ui/SearchInput'
import { SETTINGS_SECTIONS as SECTIONS, type SettingsSection as Section } from './sections'


/** Small previews of the three themes */
/** The width of the sections, and of the header so its search lines up with their cards */
const SECTION_WIDTH = 'max-w-[860px]'

const THEMES: { id: Theme; bg: string; side: string; card: string; ink: string; line: string; accent: string }[] = [
  { id: 'dark', bg: '#121110', side: '#151311', card: '#1A1816', ink: '#F2EEE9', line: '#2E2A26', accent: '#FF7A33' },
  { id: 'light', bg: '#F7F4F0', side: '#FBF9F6', card: '#FFFFFF', ink: '#1E1A16', line: '#E4DED6', accent: '#B53C0B' },
  { id: 'system', bg: 'linear-gradient(90deg,#121110 50%,#F7F4F0 50%)', side: '#151311', card: '#2E2A26', ink: '#B5ADA4', line: '#2E2A26', accent: '#FF7A33' }
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

  useEffect(() => { window.devforge.getSettings().then(setSettings) }, [])

  // "Saved" shows for two seconds after each change
  const [savedVisible, setSavedVisible] = useState(false)
  useEffect(() => {
    if (!savedAt) return
    setSavedVisible(true)
    const id = setTimeout(() => setSavedVisible(false), 2000)
    return () => clearTimeout(id)
  }, [savedAt])
  const onSaved = () => setSavedAt(Date.now())

  /** Every change is saved at once (the projects folders: when a field loses focus) */
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

  const q = query.trim().toLowerCase()
  const shown = SECTIONS.filter(x => !q || `${s.nav[x.id]} ${x.words}`.toLowerCase().includes(q))
  const section: Section | null = shown.find(x => x.id === asked)?.id ?? shown[0]?.id ?? null
  const go = (id: Section) => setParams({ section: id }, { replace: true })

  if (!settings) return <Page><p className="text-fg-muted">{t.common.loading}</p></Page>

  if (notes) return <Page><ReleaseNotes focus={notes === 'all' ? null : notes} onBack={() => setParams({ section: 'updates' }, { replace: true })} /></Page>

  return (
    <Page className="gap-5.5">
      <div className={cn('df-rise flex flex-wrap items-end gap-3', SECTION_WIDTH)}>
        <div className="min-w-[220px] flex-1">
          <h1 className="font-display text-page font-bold tracking-[-.025em] text-fg">{s.title}</h1>
          <p className="mt-1 text-base text-fg-secondary">{s.subtitle}</p>
        </div>
        <span aria-live="polite" className={cn('flex h-[30px] items-center gap-1.5 rounded-full bg-success-soft px-3 text-xs font-medium text-success transition-opacity duration-300', savedVisible ? 'opacity-100' : 'opacity-0')}>
          <Check size={13} strokeWidth={2.6} /> {s.autoSaved}
        </span>
        <SearchInput className="w-full sm:w-64" value={query} onChange={setQuery} placeholder={s.searchPlaceholder} />
      </div>

      {/* The sections are in the menu's panel; here they show as a row of chips on a narrow page (a small
          window, Forgy's panel open) and while searching, as the results */}
      <div className="@container">
        <div className="flex flex-col gap-4">
          <nav aria-label={s.title} className={cn('df-rise flex flex-wrap gap-1.5', !q && '@min-[760px]:hidden')}>
            {shown.map(x => (
              <button key={x.id} onClick={() => go(x.id)} aria-current={section === x.id ? 'page' : undefined}
                className={cn('flex h-8 items-center gap-2 rounded-control border px-2.5 text-left text-base font-medium transition-colors',
                  section === x.id ? 'border-accent bg-accent-soft text-fg' : 'border-line text-fg-secondary hover:bg-surface hover:text-fg')}>
                <x.icon size={16} aria-hidden />
                <span className="flex-1">{s.nav[x.id]}</span>
              </button>
            ))}
            {!shown.length && <p className="mx-2.5 my-1.5 text-sm text-fg-muted">{s.noMatch}</p>}
          </nav>

          <section key={section ?? 'none'} className={cn('flex min-w-0 flex-1 flex-col gap-4.5', SECTION_WIDTH)}>
            {section === 'general' && (
              <SettingsCard title={s.nav.general} hint={s.generalHint}>
                <SettingRow label={s.defaultDir} hint={s.defaultDirHint}>
                  <ProjectFolders key={projectFolders(settings).join('\n')} settings={settings} update={update} />
                </SettingRow>
                <SettingRow label={s.defaultPM} hint={s.defaultPMHint}>
                  <Segmented<PackageManager> label={s.defaultPM} mono value={settings.defaultPackageManager} onChange={v => set('defaultPackageManager', v)}
                    items={(['npm', 'pnpm', 'yarn'] as const).map(pm => ({ value: pm, label: pm }))} />
                </SettingRow>
                <IdeSettings settings={settings} update={update} />
                <SettingRow label={s.startWithWindows} hint={s.startWithWindowsHint}>
                  <Switch checked={settings.startWithWindows} onChange={v => set('startWithWindows', v)} label={s.startWithWindows} />
                </SettingRow>
                <SettingRow label={s.terminalSuggest} hint={s.terminalSuggestHint}>
                  <Switch checked={settings.terminalSuggest !== false} onChange={v => set('terminalSuggest', v)} label={s.terminalSuggest} />
                </SettingRow>
                <SettingRow label={s.ciAlerts} hint={s.ciAlertsHint}>
                  <Segmented<'favorites' | 'all' | 'off'> label={s.ciAlerts} value={settings.ciAlerts ?? 'favorites'} onChange={v => set('ciAlerts', v)}
                    items={[{ value: 'favorites', label: s.ciAlertsFavorites }, { value: 'all', label: s.ciAlertsAll }, { value: 'off', label: s.ciAlertsOff }]} />
                </SettingRow>
                <SettingRow label={s.minimizeToTray} hint={s.minimizeToTrayHint}>
                  <Switch checked={settings.minimizeToTray} onChange={v => set('minimizeToTray', v)} label={s.minimizeToTray} />
                </SettingRow>
              </SettingsCard>
            )}
            {section === 'general' && <LauncherSettings settings={settings} update={update} />}
            {section === 'templates' && <TemplatesSettings />}

            {section === 'appearance' && (
              <SettingsCard title={s.nav.appearance} hint={s.appearanceHint}>
                <div className="px-5 pt-1 pb-4.5">
                  <div className="mb-2.5 text-base font-medium text-fg">{s.theme}</div>
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
                              <span className="h-[5px] w-[80%] rounded-[3px]" style={{ background: th.accent }} />
                            </div>
                            <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                              <span className="h-[7px] w-1/2 rounded-[3px]" style={{ background: th.ink }} />
                              <span className="flex-1 rounded-md" style={{ background: th.card }} />
                            </div>
                          </div>
                          <span className="flex items-center gap-2 text-base font-medium text-fg">
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
            {section === 'connections' && <ConnectionsSettings />}
            {section === 'servers' && <ServerSettings onSaved={onSaved} />}
            {section === 'data' && <DataSettings onCopyReport={copyReport} />}
            {section === 'updates' && <UpdatesSettings settings={settings} set={set} onNotes={() => setParams({ notes: 'all' }, { replace: true })} />}

            {section === 'about' && (
              <SettingsCard title={s.nav.about}>
                <dl className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] border-t border-line-subtle">
                  {[[s.version, `${__APP_VERSION__} · ${settings.updateChannel === 'beta' ? s.channelBeta : s.channelStable}`], [s.commit, __APP_COMMIT__],
                    [s.builtOnLabel, new Date(__BUILD_DATE__).toLocaleDateString()], ['Electron', navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] ?? '—']].map(([k, v]) => (
                    <div key={k} className="px-5 py-3.5">
                      <dt className="font-mono text-2xs font-medium tracking-[.08em] text-fg-muted uppercase">{k}</dt>
                      <dd className="mt-1 font-mono text-base font-medium text-fg">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2 border-t border-line-subtle px-5 py-4">
                  <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(__REPO_URL__)}>{s.githubPage}</Button>
                  <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(`${__REPO_URL__}/issues/new`)}>{s.reportIssue}</Button>
                  <Button size="sm" variant="secondary" onClick={() => setParams({ notes: 'all' }, { replace: true })}>{s.releaseNotes}</Button>
                  <Button size="sm" variant="secondary" onClick={copyReport}>{s.copyReport}</Button>
                  <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(`${__REPO_URL__}/blob/main/LICENSE`)}>{s.viewLicense}</Button>
                </div>
                {/* GPL-3.0 section 5d: an interactive program shows its legal notices */}
                <p className="border-t border-line-subtle px-5 py-4 text-sm text-fg-secondary">{s.legalNotice}</p>
              </SettingsCard>
            )}
          </section>
        </div>
      </div>
    </Page>
  )
}
