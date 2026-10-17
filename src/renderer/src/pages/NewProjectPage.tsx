import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Framework, PackageManager, ProjectCreationOptions, AppSettings } from '../../../shared/types'
import { PROJECT_TEMPLATES } from '../../../shared/projectTemplates'
import { PROJECT_LIBRARIES, JS_FRAMEWORKS, type LibraryCategory } from '../../../shared/projectLibraries'
import { useI18n } from '../i18n/I18nContext'
import { useConsole } from '../contexts/ConsoleContext'
import Button from '../components/UI/Button'
import FrameworkIcon from '../components/UI/FrameworkIcon'
import styles from './NewProjectPage.module.css'

// ─── Step 1: Technology selector ─────────────────────────────────────────────

function TechSelector({ onSelect }: { onSelect: (fw: Framework) => void }) {
  const { t } = useI18n()
  const categories = ['frontend', 'fullstack', 'backend', 'other'] as const
  const categoryLabels = {
    frontend: t.newProject.catFrontend,
    fullstack: t.newProject.catFullstack,
    backend:  t.newProject.catBackend,
    other:    t.newProject.catOther
  }

  return (
    <div className={styles.techSelector}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t.newProject.title}</h1>
        <p className={styles.subtitle}>{t.newProject.subtitle}</p>
      </div>

      {categories.map(cat => {
        const templates = PROJECT_TEMPLATES.filter(t => t.category === cat)
        if (templates.length === 0) return null
        return (
          <section key={cat} className={styles.section}>
            <h2 className={styles.sectionTitle}>{categoryLabels[cat]}</h2>
            <div className={styles.techGrid}>
              {templates.map(t => (
                <button
                  key={t.id}
                  className={styles.techCard}
                  onClick={() => onSelect(t.id)}
                  style={{ '--card-color': t.color } as React.CSSProperties}
                >
                  <FrameworkIcon name={t.iconName} size={22} className={styles.techIcon} style={{ color: t.color }} />
                  <span className={styles.techName}>{t.name}</span>
                  <span className={styles.techDesc}>{t.description}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

// ─── Step 2: Configuration form ───────────────────────────────────────────────

interface FormState {
  name:           string
  destination:    string
  packageManager: PackageManager
  typescript:     boolean
  eslint:         boolean
  initGit:        boolean
  installDeps:    boolean
  openAfter:      boolean
}

function ConfigForm({
  framework, settings, onBack, onSubmit
}: {
  framework: Framework
  settings:  AppSettings | null
  onBack:    () => void
  onSubmit:  (opts: ProjectCreationOptions) => void
}) {
  const { t } = useI18n()
  const template       = PROJECT_TEMPLATES.find(t => t.id === framework)!
  const defaultOptions = Object.fromEntries(template.options.map(o => [o.id, o.default])) as Partial<FormState>

  const [form,   setForm]   = useState<FormState>({
    name:           '',
    destination:    settings?.defaultProjectsDir ?? '',
    packageManager: settings?.defaultPackageManager ?? 'npm',
    typescript:     defaultOptions.typescript  ?? false,
    eslint:         defaultOptions.eslint       ?? false,
    initGit:        defaultOptions.initGit      ?? false,
    installDeps:    defaultOptions.installDeps  ?? true,
    openAfter:      defaultOptions.openAfter    ?? false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f  => ({ ...f, [key]: value }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  async function browseDestination() {
    const dir = await window.devforge.selectDirectory()
    if (dir) set('destination', dir)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) {
      errs.name = t.newProject.errNameReq
    } else if (!/^[a-zA-Z0-9_-]+$/.test(form.name)) {
      errs.name = t.newProject.errNameInvalid
    }
    if (!form.destination.trim()) {
      errs.destination = t.newProject.errDestReq
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSubmit({
      name:           form.name.trim(),
      destination:    form.destination.trim(),
      framework,
      packageManager: form.packageManager,
      typescript:     form.typescript,
      eslint:         form.eslint,
      initGit:        form.initGit,
      installDeps:    form.installDeps,
      openAfter:      form.openAfter
    })
  }

  const hasOption = (id: string) => template.options.some(o => o.id === id)

  return (
    <div className={styles.configForm}>
      <div className={styles.configHeader}>
        <button className={styles.backBtn} onClick={onBack}>{t.newProject.back}</button>
        <div>
          <h1 className={styles.title}>
            <FrameworkIcon name={template.iconName} size={20} style={{ color: template.color }} />
            {t.newProject.configTitle.replace('{name}', template.name)}
          </h1>
          <p className={styles.subtitle}>{t.newProject.configSubtitle}</p>
        </div>
      </div>

      <div className={styles.formBody}>
        {/* Project name */}
        <div className={styles.field}>
          <label className={styles.label}>{t.newProject.labelName}</label>
          <input
            className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="my-project"
            spellCheck={false}
          />
          {errors.name && <span className={styles.errorMsg}>{errors.name}</span>}
        </div>

        {/* Destination */}
        <div className={styles.field}>
          <label className={styles.label}>{t.newProject.labelDest}</label>
          <div className={styles.pathRow}>
            <input
              className={`${styles.input} ${errors.destination ? styles.inputError : ''}`}
              value={form.destination}
              onChange={e => set('destination', e.target.value)}
              placeholder="C:\Users\...\Development"
              spellCheck={false}
            />
            <Button variant="secondary" size="md" onClick={browseDestination}>{t.newProject.browse}</Button>
          </div>
          {errors.destination && <span className={styles.errorMsg}>{errors.destination}</span>}
          {form.destination && form.name && (
            <span className={styles.pathPreview}>
              {form.destination.replace(/[/\\]$/, '')}{form.destination.includes('/') ? '/' : '\\'}{form.name}
            </span>
          )}
        </div>

        {/* Package manager */}
        {['react', 'nextjs', 'vue', 'nodejs'].includes(framework) && (
          <div className={styles.field}>
            <label className={styles.label}>{t.newProject.labelPM}</label>
            <div className={styles.radioGroup}>
              {(['npm', 'pnpm', 'yarn'] as PackageManager[]).map(pm => (
                <label key={pm} className={styles.radio}>
                  <input type="radio" name="pm" value={pm} checked={form.packageManager === pm} onChange={() => set('packageManager', pm)} />
                  {pm}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Options */}
        <div className={styles.field}>
          <label className={styles.label}>{t.newProject.labelOptions}</label>
          <div className={styles.checkboxGroup}>
            {hasOption('typescript') && (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.typescript} onChange={e => set('typescript', e.target.checked)} />
                {t.newProject.optTypescript}
              </label>
            )}
            {hasOption('eslint') && (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.eslint} onChange={e => set('eslint', e.target.checked)} />
                {t.newProject.optEslint}
              </label>
            )}
            {hasOption('initGit') && (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.initGit} onChange={e => set('initGit', e.target.checked)} />
                {t.newProject.optGit}
              </label>
            )}
            {hasOption('installDeps') && (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.installDeps} onChange={e => set('installDeps', e.target.checked)} />
                {t.newProject.optInstall}
              </label>
            )}
            {hasOption('openAfter') && (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={form.openAfter} onChange={e => set('openAfter', e.target.checked)} />
                {t.newProject.optOpen}
              </label>
            )}
          </div>
        </div>
      </div>

      <div className={styles.formFooter}>
        <Button variant="ghost" onClick={onBack}>{t.newProject.cancel}</Button>
        <Button onClick={handleSubmit} size="lg">
          {JS_FRAMEWORKS.includes(framework) ? t.newProject.next : t.newProject.create}
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Library selector ─────────────────────────────────────────────────

const CAT_LABEL_KEY: Record<LibraryCategory, keyof ReturnType<typeof useI18n>['t']['newProject']> = {
  'styling':      'libCatStyling',
  'state':        'libCatState',
  'data-fetching':'libCatFetching',
  'routing':      'libCatRouting',
  'forms':        'libCatForms',
  'validation':   'libCatValidation',
  'ui':           'libCatUi',
  'animation':    'libCatAnimation',
  'utils':        'libCatUtils',
  'i18n':         'libCatI18n',
  'testing':      'libCatTesting',
  'database':     'libCatDatabase',
  'auth':         'libCatAuth',
  'api':          'libCatApi',
}

function LibrarySelector({
  framework, onBack, onSubmit
}: {
  framework: Framework
  onBack: () => void
  onSubmit: (packages: string[], devPackages: string[]) => void
}) {
  const { t }                         = useI18n()
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [search, setSearch]           = useState('')
  const [activeCategory, setCategory] = useState<LibraryCategory | 'all'>('all')
  const gridRef                       = useRef<HTMLDivElement>(null)

  const available = PROJECT_LIBRARIES.filter(lib =>
    lib.frameworks === 'all' || (lib.frameworks as Framework[]).includes(framework)
  )

  const filtered = available.filter(lib => {
    const matchCat  = activeCategory === 'all' || lib.category === activeCategory
    const matchText = !search ||
      lib.name.toLowerCase().includes(search.toLowerCase()) ||
      lib.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchText
  })

  const categories = Array.from(new Set(available.map(l => l.category)))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function handleCreate() {
    const libs    = PROJECT_LIBRARIES.filter(l => selected.has(l.id))
    const pkgs    = libs.flatMap(l => l.packages)
    const devPkgs = libs.flatMap(l => l.devPackages ?? [])
    onSubmit(pkgs, devPkgs)
  }

  const n = selected.size
  const createLabel = n === 0
    ? t.newProject.libCreate
    : t.newProject.libCreateWith.replace('{n}', String(n)).replace('{s}', n > 1 ? 's' : '')

  return (
    <div className={styles.libSelector}>
      <div className={styles.libHeader}>
        <button className={styles.backBtn} onClick={onBack}>{t.newProject.back}</button>
        <div>
          <h1 className={styles.title}>{t.newProject.libTitle}</h1>
          <p className={styles.subtitle}>{t.newProject.libSubtitle}</p>
        </div>
      </div>

      <div className={styles.libToolbar}>
        <input
          className={styles.libSearch}
          placeholder={t.newProject.libSearch}
          value={search}
          onChange={e => { setSearch(e.target.value); setCategory('all') }}
        />
        <div className={styles.libCategories}>
          <button
            className={`${styles.catBtn} ${activeCategory === 'all' ? styles.catActive : ''}`}
            onClick={() => setCategory('all')}
          >
            {t.newProject.libCatAll}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`${styles.catBtn} ${activeCategory === cat ? styles.catActive : ''}`}
              onClick={() => setCategory(cat)}
            >
              {t.newProject[CAT_LABEL_KEY[cat]]}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.libGrid} ref={gridRef}>
        {filtered.map(lib => {
          const isSelected = selected.has(lib.id)
          return (
            <button
              key={lib.id}
              className={`${styles.libCard} ${isSelected ? styles.libCardSelected : ''}`}
              onClick={() => toggle(lib.id)}
              style={{ '--lib-color': lib.color } as React.CSSProperties}
            >
              <div className={styles.libCardTop}>
                <span className={styles.libDot} style={{ background: lib.color }} />
                {isSelected && <span className={styles.libCheck}>✓</span>}
              </div>
              <span className={styles.libName}>{lib.name}</span>
              <span className={styles.libDesc}>{lib.description}</span>
              <span className={styles.libPkg}>{lib.packages[0] ?? lib.devPackages?.[0] ?? ''}</span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className={styles.libEmpty}>No libraries found for "{search}"</p>
        )}
      </div>

      <div className={styles.libFooter}>
        <Button variant="ghost" onClick={onBack}>{t.newProject.libSkip}</Button>
        <Button onClick={handleCreate} size="lg">{createLabel}</Button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const navigate      = useNavigate()
  const { t }         = useI18n()
  const console_      = useConsole()
  const [step,        setStep]    = useState<'select' | 'configure' | 'libraries'>('select')
  const [framework,   setFw]      = useState<Framework | null>(null)
  const [pending,     setPending] = useState<ProjectCreationOptions | null>(null)
  const [settings,    setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.devforge.getSettings().then(setSettings)
  }, [])

  function handleConfigNext(options: ProjectCreationOptions) {
    setPending(options)
    // only show library step for JS-capable frameworks
    if (JS_FRAMEWORKS.includes(options.framework)) {
      setStep('libraries')
    } else {
      launchCreation(options, [], [])
    }
  }

  async function launchCreation(options: ProjectCreationOptions, pkgs: string[], devPkgs: string[]) {
    await console_.startCreation({ ...options, libraries: pkgs, devLibraries: devPkgs })
    navigate('/')
  }

  return (
    <div className={styles.page}>
      {step === 'select' && (
        <TechSelector onSelect={fw => { setFw(fw); setStep('configure') }} />
      )}
      {step === 'configure' && framework && (
        <ConfigForm
          framework={framework}
          settings={settings}
          onBack={() => setStep('select')}
          onSubmit={handleConfigNext}
        />
      )}
      {step === 'libraries' && framework && pending && (
        <LibrarySelector
          framework={framework}
          onBack={() => setStep('configure')}
          onSubmit={(pkgs, devPkgs) => launchCreation(pending, pkgs, devPkgs)}
        />
      )}
    </div>
  )
}
