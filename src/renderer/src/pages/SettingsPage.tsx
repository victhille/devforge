import { useState, useEffect } from 'react'
import type { AppSettings, PackageManager, DefaultIDE, Theme, AppLanguage } from '../../../shared/types'
import { useI18n } from '../i18n/I18nContext'
import Button from '../components/UI/Button'
import styles from './SettingsPage.module.css'

export default function SettingsPage() {
  const { t, lang, setLang } = useI18n()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saved, setSaved] = useState(false)

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

  if (!settings) return <div className={styles.loading}>{t.common.loading}</div>

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t.settings.title}</h1>
          <p className={styles.subtitle}>{t.settings.subtitle}</p>
        </div>
        <Button onClick={handleSave} variant={saved ? 'secondary' : 'primary'}>
          {saved ? t.settings.saved : t.settings.save}
        </Button>
      </div>

      <div className={styles.sections}>
        {/* ── General ─────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.sectionGeneral}</h2>
          <div className={styles.fieldGroup}>

            <div className={styles.field}>
              <label className={styles.label}>{t.settings.defaultDir}</label>
              <div className={styles.pathRow}>
                <input className={styles.input} value={settings.defaultProjectsDir}
                  onChange={e => set('defaultProjectsDir', e.target.value)} />
                <Button variant="secondary" size="sm" onClick={browseProjDir}>{t.settings.browse}</Button>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t.settings.defaultPM}</label>
              <div className={styles.radioGroup}>
                {(['npm', 'pnpm', 'yarn'] as PackageManager[]).map(pm => (
                  <label key={pm} className={`${styles.radio} ${settings.defaultPackageManager === pm ? styles.radioActive : ''}`}>
                    <input type="radio" name="pm" checked={settings.defaultPackageManager === pm} onChange={() => set('defaultPackageManager', pm)} />
                    {pm}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t.settings.defaultIDE}</label>
              <div className={styles.radioGroup}>
                {([['vscode', 'VS Code'], ['phpstorm', 'PhpStorm'], ['webstorm', 'WebStorm'], ['none', t.settings.ideNone]] as [DefaultIDE, string][]).map(([id, label]) => (
                  <label key={id} className={`${styles.radio} ${settings.defaultIDE === id ? styles.radioActive : ''}`}>
                    <input type="radio" name="ide" checked={settings.defaultIDE === id} onChange={() => set('defaultIDE', id)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── Appearance ──────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.sectionAppearance}</h2>
          <div className={styles.fieldGroup}>

            <div className={styles.field}>
              <label className={styles.label}>{t.settings.theme}</label>
              <div className={styles.radioGroup}>
                {([['dark', t.settings.themeDark], ['light', t.settings.themeLight], ['system', t.settings.themeSystem]] as [Theme, string][]).map(([id, label]) => (
                  <label key={id} className={`${styles.radio} ${settings.theme === id ? styles.radioActive : ''}`}>
                    <input type="radio" name="theme" checked={settings.theme === id} onChange={() => set('theme', id)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t.settings.language}</label>
              <div className={styles.radioGroup}>
                {([['en', t.settings.langEn], ['fr', t.settings.langFr]] as [AppLanguage, string][]).map(([id, label]) => (
                  <label key={id} className={`${styles.radio} ${settings.language === id ? styles.radioActive : ''}`}>
                    <input type="radio" name="lang" checked={settings.language === id} onChange={() => set('language', id)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* ── Behavior ────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.sectionBehavior}</h2>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <label className={styles.toggleRow}>
                <span>{t.settings.startWithWindows}</span>
                <input type="checkbox" className={styles.toggle} checked={settings.startWithWindows} onChange={e => set('startWithWindows', e.target.checked)} />
              </label>
            </div>
            <div className={styles.field}>
              <label className={styles.toggleRow}>
                <span>{t.settings.minimizeToTray}</span>
                <input type="checkbox" className={styles.toggle} checked={settings.minimizeToTray} onChange={e => set('minimizeToTray', e.target.checked)} />
              </label>
            </div>
          </div>
        </section>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.settings.sectionAbout}</h2>
          <div className={styles.fieldGroup}>
            <div className={styles.field}>
              <span className={styles.label}>{t.settings.version}</span>
              <span className={styles.value}>DevForge v0.1.0</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
