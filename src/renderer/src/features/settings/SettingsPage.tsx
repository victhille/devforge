import { useState, useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ExternalLink, ScrollText } from 'lucide-react'
import type { AppSettings, PackageManager, DefaultIDE, Theme, AppLanguage } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Switch from '@renderer/components/ui/Switch'
import Tabs from '@renderer/components/ui/Tabs'
import { Input } from '@renderer/components/ui/Input'
import Badge from '@renderer/components/ui/Badge'
import Modal from '@renderer/components/ui/Modal'
import ReleaseNotes from './ReleaseNotes'
import AssistantSettings from './AssistantSettings'
import { Page, PageHeader, SectionTitle } from '@renderer/components/ui/Page'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <SectionTitle>{title}</SectionTitle>
      <Card className="divide-y divide-line-subtle">{children}</Card>
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-4">
      <span className="text-sm font-medium uppercase tracking-wide text-fg-secondary">{label}</span>
      {children}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 text-fg-secondary">
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)
  // ?notes=<version> (from the "what's new" toast) opens the release notes
  const [params, setParams] = useSearchParams()
  const [notes, setNotes] = useState<string | null>(() => params.get('notes'))
  const prerelease = __APP_VERSION__.includes('-')

  useEffect(() => {
    window.devforge.getSettings().then(setSettings)
  }, [])

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
    setSaved(false)
  }

  async function handleSave() {
    if (!settings) return
    await window.devforge.saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setLang(settings.language)
    document.documentElement.setAttribute('data-theme', settings.theme)
  }

  async function browseProjDir() {
    const dir = await window.devforge.selectDirectory()
    if (dir) set('defaultProjectsDir', dir)
  }

  if (!settings) return <Page><p className="text-fg-muted">{t.common.loading}</p></Page>

  return (
    <Page className="max-w-2xl">
      <PageHeader
        title={t.settings.title}
        subtitle={t.settings.subtitle}
        actions={
          <Button onClick={handleSave} variant={saved ? 'secondary' : 'primary'}>
            {saved && <Check size={14} />}
            {saved ? t.settings.saved : t.settings.save}
          </Button>
        }
      />

      <Section title={t.settings.sectionGeneral}>
        <Row label={t.settings.defaultDir}>
          <div className="flex gap-2">
            <Input value={settings.defaultProjectsDir} onChange={e => set('defaultProjectsDir', e.target.value)} />
            <Button variant="secondary" size="md" onClick={browseProjDir}>{t.settings.browse}</Button>
          </div>
        </Row>
        <Row label={t.settings.defaultPM}>
          <Tabs<PackageManager>
            value={settings.defaultPackageManager}
            onChange={v => set('defaultPackageManager', v)}
            items={(['npm', 'pnpm', 'yarn'] as const).map(pm => ({ value: pm, label: pm }))}
          />
        </Row>
        <Row label={t.settings.defaultIDE}>
          <Tabs<DefaultIDE>
            value={settings.defaultIDE}
            onChange={v => set('defaultIDE', v)}
            items={[
              { value: 'vscode',   label: 'VS Code' },
              { value: 'phpstorm', label: 'PhpStorm' },
              { value: 'webstorm', label: 'WebStorm' },
              { value: 'none',     label: t.settings.ideNone }
            ]}
          />
        </Row>
      </Section>

      <Section title={t.settings.sectionAppearance}>
        <Row label={t.settings.theme}>
          <Tabs<Theme>
            value={settings.theme}
            onChange={v => set('theme', v)}
            items={[
              { value: 'dark',   label: t.settings.themeDark },
              { value: 'light',  label: t.settings.themeLight },
              { value: 'system', label: t.settings.themeSystem }
            ]}
          />
        </Row>
        <Row label={t.settings.language}>
          <Tabs<AppLanguage>
            value={settings.language}
            onChange={v => set('language', v)}
            items={[
              { value: 'en', label: t.settings.langEn },
              { value: 'fr', label: t.settings.langFr }
            ]}
          />
        </Row>
      </Section>

      <Section title={t.settings.sectionBehavior}>
        <ToggleRow label={t.settings.startWithWindows} checked={settings.startWithWindows} onChange={v => set('startWithWindows', v)} />
        <ToggleRow label={t.settings.minimizeToTray}   checked={settings.minimizeToTray}   onChange={v => set('minimizeToTray', v)} />
      </Section>

      <AssistantSettings />

      <Section title={t.settings.sectionAbout}>
        <Row label={t.settings.version}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-fg">DevForge v{__APP_VERSION__}</span>
            <Badge color={prerelease ? 'warning' : 'success'}>{prerelease ? t.settings.channelPre : t.settings.channelStable}</Badge>
            <span className="font-mono text-xs text-fg-muted" title={__BUILD_DATE__}>
              {__APP_COMMIT__} · {t.settings.builtOn.replace('{d}', new Date(__BUILD_DATE__).toLocaleDateString())}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setNotes('all')}><ScrollText size={13} /> {t.settings.releaseNotes}</Button>
            <Button size="sm" variant="ghost" onClick={() => window.devforge.openExternal('https://github.com/victhille/devforge/releases')}>
              <ExternalLink size={13} /> {t.settings.allReleases}
            </Button>
          </div>
        </Row>
      </Section>
      {notes && (
        <Modal title={t.settings.releaseNotes} onClose={() => { setNotes(null); if (params.has('notes')) setParams({}, { replace: true }) }}>
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <ReleaseNotes markdown={__CHANGELOGS__[lang] || __CHANGELOGS__.fr} only={notes === 'all' ? undefined : notes} />
          </div>
          {notes !== 'all' && <Button size="sm" variant="ghost" onClick={() => setNotes('all')}>{t.settings.allVersions}</Button>}
        </Modal>
      )}
    </Page>
  )
}
