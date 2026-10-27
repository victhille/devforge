import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { ProjectCreationOptions, ProjectSetup } from '@shared/types'
import { planSetup, REPO_RE, stepCommand } from '@shared/lib/projectSetup'
import { WELCOME_FRAMEWORKS } from '@shared/lib/welcomePage'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import Tabs from '@renderer/components/ui/Tabs'
import { Field, Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'

interface Props {
  options: ProjectCreationOptions
  stack: Pick<ProjectSetup, 'database' | 'dbName' | 'dbPort' | 'appPort' | 'features'> | null
  libraries: number
  onBack: () => void
  onSubmit: (setup: ProjectSetup) => void
}

/** Last step: Git, GitHub, VS Code, then the summary of every command */
export default function FinishForm({ options, stack, libraries, onBack, onSubmit }: Props) {
  const { t, lang } = useI18n()
  const s = t.newProject.setup
  const [git, setGit] = useState(true)
  const [github, setGithub] = useState(false)
  const [isPrivate, setPrivate] = useState(true)
  const [repo, setRepo] = useState(options.name)
  const [openVSCode, setOpenVSCode] = useState(true)
  const [welcome, setWelcome] = useState(true)
  const [login, setLogin] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [volumes, setVolumes] = useState<string[]>([])
  const serverDb = stack?.database === 'postgres' || stack?.database === 'mysql'

  // A project of the same name created before: its database stays, apart from the new one
  useEffect(() => {
    if (!serverDb) return
    let alive = true
    window.devforge.setup.previousVolumes(options.name).then(v => { if (alive) setVolumes(v) }).catch(() => {})
    return () => { alive = false }
  }, [serverDb, options.name])

  useEffect(() => {
    let alive = true
    window.devforge.setup.githubLogin().then(l => { if (alive) setLogin(l) }).catch(() => { if (alive) setLogin(null) })
    return () => { alive = false }
  }, [])

  const repoOk = REPO_RE.test(repo)
  const setup: ProjectSetup = {
    database: stack?.database ?? 'none', dbName: stack?.dbName ?? '', dbPort: stack?.dbPort ?? 0, appPort: stack?.appPort, features: stack?.features ?? [],
    git: git || github, github: github ? { repo, private: isPrivate } : null, openVSCode,
    welcome: WELCOME_FRAMEWORKS.includes(options.framework) && welcome
  }
  const steps = planSetup({ ...options, setup }, { password: '••••', secret: '••••', composeName: '', lang: lang === 'en' ? 'en' : 'fr' })
  const template = PROJECT_TEMPLATES.find(tpl => tpl.id === options.framework)

  return (
    <Page className="max-w-5xl">
      <div><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={14} /> {t.newProject.back}</Button></div>
      <PageHeader title={s.finishTitle} subtitle={s.finishSubtitle} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-5">
          <CardTitle>{s.gitTitle}</CardTitle>
          <Checkbox checked={git || github} onChange={setGit}>{s.gitInit}</Checkbox>
          <Checkbox checked={github} onChange={setGithub}>
            {s.ghCreate}
            {login && <span className="text-fg-muted">{s.ghAs.replace('{login}', login)}</span>}
          </Checkbox>
          {github && login === null && <p className="pl-6 text-sm text-warning">{s.ghNoLogin}</p>}
          {github && (
            <div className="flex flex-col gap-3 pl-6">
              <Tabs<'private' | 'public'>
                value={isPrivate ? 'private' : 'public'}
                onChange={v => setPrivate(v === 'private')}
                items={[{ value: 'private', label: s.ghPrivate }, { value: 'public', label: s.ghPublic }]}
              />
              <Field label={s.ghRepo} error={repoOk ? undefined : s.ghRepoError}>
                <Input value={repo} onChange={e => setRepo(e.target.value.trim())} className="font-mono" spellCheck={false} invalid={!repoOk} />
              </Field>
            </div>
          )}
          {WELCOME_FRAMEWORKS.includes(options.framework) && (
            <Checkbox checked={welcome} onChange={setWelcome} className="items-start">
              <span className="flex flex-col">
                <span>{s.welcome}</span>
                <span className="text-sm text-fg-muted">{s.welcomeHint}</span>
              </span>
            </Checkbox>
          )}
          <Checkbox checked={openVSCode} onChange={setOpenVSCode}>{s.openVSCode}</Checkbox>
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <CardTitle>{s.recapTitle}</CardTitle>
          <ol aria-label={s.recapTitle} tabIndex={0} className="flex max-h-[420px] flex-col gap-2 overflow-y-auto rounded-xl bg-canvas p-3 text-sm">
            <li className="flex flex-col">
              <span className="text-fg">{s.recapBase.replace('{name}', template?.name ?? options.framework)}</span>
              {libraries > 0 && <span className="text-fg-muted">{s.recapLibs.replace('{n}', String(libraries))}</span>}
            </li>
            {steps.map((step, i) => (
              <li key={i} className="flex flex-col">
                <span className="text-fg">{step.label}</span>
                {step.kind !== 'connection' && <span className="whitespace-pre-wrap font-mono text-xs text-fg-muted">{stepCommand(step)}</span>}
              </li>
            ))}
          </ol>
          <p className="text-sm text-fg-muted">{s.recapNote}</p>
          {volumes.length > 0 && (
            <p role="status" className="rounded-xl bg-warning/10 p-3 text-sm text-fg">
              {s.oldVolumes.replace('{list}', volumes.join(', '))}
            </p>
          )}
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onBack}>{t.newProject.cancel}</Button>
        <Button size="lg" disabled={busy || (github && !repoOk)} onClick={() => { setBusy(true); onSubmit(setup) }}>{t.newProject.create}</Button>
      </div>
    </Page>
  )
}
