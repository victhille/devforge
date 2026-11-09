import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { Folder } from 'lucide-react'
import type { Framework, PackageManager, ProjectCreationOptions, AppSettings, UserTemplate } from '@shared/types'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { folderName, projectFolders } from '@shared/lib/projectFolders'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Switch from '@renderer/components/ui/Switch'
import Tabs from '@renderer/components/ui/Tabs'
import { Field, Input } from '@renderer/components/ui/Input'
import { OptionRow } from './WizardFrame'

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

type BoolOption = 'typescript' | 'eslint' | 'initGit' | 'installDeps' | 'openAfter'

const PM_FRAMEWORKS: Framework[] = ['react', 'nextjs', 'vue', 'nodejs']

interface Props {
  framework: Framework
  settings:  AppSettings | null
  /** v3.8: one of the user's templates, in place of the framework's starter */
  userTemplate?: UserTemplate | null
  /** What was typed before coming back to this step */
  initial?:  ProjectCreationOptions | null
  /** The name as it is typed (the database's name and the summary follow it) */
  onName?:   (name: string) => void
}

/** The screen validates the section: its options, or null (and the errors shown) */
export interface ConfigHandle { submit: () => ProjectCreationOptions | null }

/** Step 2, first part (the mock-up's Options): name, folder, package manager and the starter's options */
const ConfigForm = forwardRef<ConfigHandle, Props>(function ConfigForm({ framework, settings, userTemplate, initial, onName }, ref) {
  const { t } = useI18n()
  const template = PROJECT_TEMPLATES.find(tpl => tpl.id === framework)
  // A user's template: only whether to install its dependencies
  const templateOptions = userTemplate ? [{ id: 'installDeps', default: true }] : template?.options ?? []
  const defaults = Object.fromEntries(templateOptions.map(o => [o.id, o.default])) as Partial<FormState>

  const [form, setForm] = useState<FormState>(initial ? {
    name: initial.name, destination: initial.destination, packageManager: initial.packageManager,
    typescript: initial.typescript, eslint: initial.eslint, initGit: initial.initGit, installDeps: initial.installDeps, openAfter: initial.openAfter
  } : {
    name:           '',
    destination:    settings?.defaultProjectsDir ?? '',
    packageManager: userTemplate?.packageManager ?? settings?.defaultPackageManager ?? 'npm',
    typescript:     defaults.typescript  ?? false,
    eslint:         defaults.eslint      ?? false,
    initGit:        defaults.initGit     ?? false,
    installDeps:    defaults.installDeps ?? true,
    openAfter:      defaults.openAfter   ?? false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => { const n = { ...e }; delete n[key]; return n })
  }

  async function browse() {
    const dir = await window.devforge.selectDirectory()
    if (dir) set('destination', dir)
  }

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!form.name.trim()) errs.name = t.newProject.errNameReq
    else if (!/^[a-zA-Z0-9_-]+$/.test(form.name)) errs.name = t.newProject.errNameInvalid
    if (!form.destination.trim()) errs.destination = t.newProject.errDestReq
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  useImperativeHandle(ref, () => ({
    submit: () => validate() ? { ...form, name: form.name.trim(), destination: form.destination.trim(), framework, ...(userTemplate ? { template: userTemplate.id } : {}) } : null
  }))
  useEffect(() => { onName?.(form.name.trim()) }, [form.name, onName])

  // Git and VS Code are chosen on the last step
  const options: { id: BoolOption; label: string }[] = [
    { id: 'typescript',  label: t.newProject.optTypescript },
    { id: 'eslint',      label: t.newProject.optEslint },
    { id: 'installDeps', label: t.newProject.optInstall }
  ].filter(o => templateOptions.some(opt => opt.id === o.id)) as { id: BoolOption; label: string }[]

  // v3.5: the projects folders, one click each
  const folders = settings ? projectFolders(settings) : []
  const sameDir = (a: string, b: string) => a.replace(/[/\\]+$/, '').toLowerCase() === b.trim().replace(/[/\\]+$/, '').toLowerCase()

  const sep = form.destination.includes('/') ? '/' : '\\'
  const preview = form.destination && form.name ? `${form.destination.replace(/[/\\]$/, '')}${sep}${form.name}` : null

  return (
    <>
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <Field label={t.newProject.labelName} error={errors.name}>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-project" spellCheck={false} invalid={!!errors.name} autoFocus className="font-mono" />
        </Field>

        <Field
          label={t.newProject.labelDest}
          error={errors.destination}
          hint={preview && <span className="font-mono">{preview}</span>}
        >
          <div className="flex gap-2">
            <Input
              value={form.destination}
              onChange={e => set('destination', e.target.value)}
              placeholder="C:\Users\...\Development"
              spellCheck={false}
              invalid={!!errors.destination}
              className="font-mono"
            />
            <Button variant="secondary" onClick={browse}>{t.newProject.browse}</Button>
          </div>
          {folders.length > 1 && (
            <div role="group" aria-label={t.newProject.destFolders} className="mt-2 flex flex-wrap gap-1.5">
              {folders.map(dir => (
                <button key={dir} type="button" title={dir} aria-pressed={sameDir(dir, form.destination)} onClick={() => set('destination', dir)}
                  className={cn('flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition-colors',
                    sameDir(dir, form.destination) ? 'border-accent/40 bg-active text-fg' : 'border-line bg-surface text-fg-secondary hover:bg-hover hover:text-fg')}>
                  <Folder size={12} aria-hidden /> {folderName(dir)}
                </button>
              ))}
            </div>
          )}
        </Field>
      </div>

      {(PM_FRAMEWORKS.includes(framework) || options.length > 0) && (
        <div className="rounded-card border border-line-subtle bg-surface px-3.5">
          {PM_FRAMEWORKS.includes(framework) && (
            <OptionRow label={t.newProject.labelPM}>
              <Tabs<PackageManager>
                label={t.newProject.labelPM}
                value={form.packageManager}
                onChange={pm => set('packageManager', pm)}
                items={(['npm', 'pnpm', 'yarn'] as const).map(pm => ({ value: pm, label: pm }))}
              />
            </OptionRow>
          )}
          {options.map(o => (
            <OptionRow key={o.id} label={t.newProject.option[o.id] ?? o.label}
              hint={o.id === 'typescript' ? t.newProject.optTsHint.replace('{name}', t.newProject.templateName[framework] ?? template?.name ?? framework) : undefined}>
              <Switch checked={form[o.id]} onChange={v => set(o.id, v)} label={t.newProject.option[o.id] ?? o.label} />
            </OptionRow>
          ))}
        </div>
      )}
    </>
  )
})

export default ConfigForm
