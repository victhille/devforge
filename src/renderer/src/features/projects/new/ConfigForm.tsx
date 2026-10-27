import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { Framework, PackageManager, ProjectCreationOptions, AppSettings } from '@shared/types'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import FrameworkIcon from '@renderer/components/ui/FrameworkIcon'
import Tabs from '@renderer/components/ui/Tabs'
import { Field, Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'

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
  onBack:    () => void
  onSubmit:  (opts: ProjectCreationOptions) => void
}

/** Step 2: name, destination and options. */
export default function ConfigForm({ framework, settings, onBack, onSubmit }: Props) {
  const { t } = useI18n()
  const template = PROJECT_TEMPLATES.find(tpl => tpl.id === framework)!
  const defaults = Object.fromEntries(template.options.map(o => [o.id, o.default])) as Partial<FormState>

  const [form, setForm] = useState<FormState>({
    name:           '',
    destination:    settings?.defaultProjectsDir ?? '',
    packageManager: settings?.defaultPackageManager ?? 'npm',
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

  function submit() {
    if (!validate()) return
    onSubmit({ ...form, name: form.name.trim(), destination: form.destination.trim(), framework })
  }

  // Git and VS Code are chosen on the last step
  const options: { id: BoolOption; label: string }[] = [
    { id: 'typescript',  label: t.newProject.optTypescript },
    { id: 'eslint',      label: t.newProject.optEslint },
    { id: 'installDeps', label: t.newProject.optInstall }
  ].filter(o => template.options.some(opt => opt.id === o.id)) as { id: BoolOption; label: string }[]

  const sep = form.destination.includes('/') ? '/' : '\\'
  const preview = form.destination && form.name ? `${form.destination.replace(/[/\\]$/, '')}${sep}${form.name}` : null

  return (
    <Page className="max-w-2xl">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="mt-1"><ArrowLeft size={14} /> {t.newProject.back}</Button>
      </div>
      <PageHeader
        icon={<FrameworkIcon name={template.iconName} size={20} style={{ color: template.color }} />}
        title={t.newProject.configTitle.replace('{name}', template.name)}
        subtitle={t.newProject.configSubtitle}
      />

      <Card className="flex flex-col gap-5 p-6">
        <Field label={t.newProject.labelName} error={errors.name}>
          <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="my-project" spellCheck={false} invalid={!!errors.name} autoFocus />
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
            />
            <Button variant="secondary" onClick={browse}>{t.newProject.browse}</Button>
          </div>
        </Field>

        {PM_FRAMEWORKS.includes(framework) && (
          <Field label={t.newProject.labelPM}>
            <Tabs<PackageManager>
              value={form.packageManager}
              onChange={pm => set('packageManager', pm)}
              items={(['npm', 'pnpm', 'yarn'] as const).map(pm => ({ value: pm, label: pm }))}
            />
          </Field>
        )}

        {options.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-fg-secondary">{t.newProject.labelOptions}</span>
            <div className="grid grid-cols-2 gap-2.5">
              {options.map(o => (
                <Checkbox key={o.id} checked={form[o.id]} onChange={v => set(o.id, v)}>{t.newProject.option[o.id] ?? o.label}</Checkbox>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>{t.newProject.cancel}</Button>
        <Button size="lg" onClick={submit}>{t.newProject.next}</Button>
      </div>
    </Page>
  )
}
