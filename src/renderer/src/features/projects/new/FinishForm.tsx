import { useEffect, useRef, useState } from 'react'
import type { ProjectCreationOptions, ProjectSetup } from '@shared/types'
import { planSetup, REPO_RE, stepCommand } from '@shared/lib/projectSetup'
import { WELCOME_FRAMEWORKS } from '@shared/lib/welcomePage'
import { API_URL_RE, DEFAULT_API_URL } from '@shared/lib/spaAuthTemplate'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import { Field, Input } from '@renderer/components/ui/Input'
import WizardFrame, { type WizardStep } from './WizardFrame'
import CreationProgress from './CreationProgress'

interface Props {
  options: ProjectCreationOptions
  stack: Pick<ProjectSetup, 'database' | 'dbName' | 'dbPort' | 'appPort' | 'features'> | null
  libraries: number
  /** v3.8: created from this template of the user */
  templateName?: string
  steps: WizardStep[]
  /** "Create" was clicked: the page follows the creation */
  creating: boolean
  onBack: () => void
  /** view: what the progress lists, and the steps bar as it is now */
  onSubmit: (setup: ProjectSetup, makeActive: boolean, view: { planned: string[]; steps: string[] }) => void
}


/** Last step: Git, GitHub, the IDE and the summary of every command, then the creation followed here */
export default function FinishForm({ options, stack, libraries, templateName, steps: wizardSteps, creating, onBack, onSubmit }: Props) {
  const { t, lang } = useI18n()
  const s = t.newProject.setup
  const [git, setGit] = useState(true)
  const [github, setGithub] = useState(false)
  const [isPrivate, setPrivate] = useState(true)
  const [repo, setRepo] = useState(options.name)
  const repoTouched = useRef(false)
  const [openVSCode, setOpenVSCode] = useState(true)
  const [makeActive, setMakeActive] = useState(true)
  const [welcome, setWelcome] = useState(true)
  // v3.4: a React or Vue front (TypeScript) can be the contract's client
  const spa = !options.template && (options.framework === 'react' || options.framework === 'vue') && options.typescript
  const [spaAuth, setSpaAuth] = useState(false)
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL)
  const apiOk = !spaAuth || API_URL_RE.test(apiUrl)
  const [login, setLogin] = useState<string | null | undefined>(undefined)
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
    window.devforge.setup.githubLogin().then(l => {
      if (!alive) return
      setLogin(l)
      // The repository goes under the gh account, unless renamed by hand
      if (l && !repoTouched.current) setRepo(`${l}/${options.name}`)
    }).catch(() => { if (alive) setLogin(null) })
    return () => { alive = false }
  }, [options.name])

  const repoOk = REPO_RE.test(repo)
  const setup: ProjectSetup = {
    database: stack?.database ?? 'none', dbName: stack?.dbName ?? '', dbPort: stack?.dbPort ?? 0, appPort: stack?.appPort, features: stack?.features ?? [],
    git: git || github, github: github ? { repo, private: isPrivate } : null, openVSCode,
    welcome: !options.template && WELCOME_FRAMEWORKS.includes(options.framework) && welcome,
    ...(spa && spaAuth ? { features: ['auth'], apiUrl } : {})
  }
  const steps = planSetup({ ...options, setup }, { password: '••••', secret: '••••', composeName: '', lang: lang === 'en' ? 'en' : 'fr' })
  const template = PROJECT_TEMPLATES.find(tpl => tpl.id === options.framework)
  const baseLabel = templateName ? t.templates.recapCopy.replace('{name}', templateName) : s.recapBase.replace('{name}', t.newProject.templateName[options.framework] ?? template?.name ?? options.framework)
  // A rough guess: the commands are what takes time
  const minutes = Math.max(1, Math.round((40 + 20 * steps.filter(x => x.kind === 'run').length) / 60))

  // The plan and the steps bar, frozen at the click: what the progress follows, from any page
  function create() {
    onSubmit(setup, makeActive, { planned: [baseLabel, ...steps.map(x => x.label)], steps: wizardSteps.map(x => x.label) })
  }

  return (
    <WizardFrame
      steps={wizardSteps}
      subtitle={s.finishSubtitle}
      onBack={onBack}
      hint={creating ? undefined : s.recapNote}
      footer={creating ? undefined : (
        <Button size="lg" disabled={(github && !repoOk) || !apiOk} onClick={create}>{t.newProject.create}</Button>
      )}
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cn('flex flex-col gap-3 p-5', creating && 'pointer-events-none opacity-60')} aria-disabled={creating || undefined}>
          <CardTitle>{s.gitTitle}</CardTitle>
          <Checkbox checked={git || github} onChange={setGit}>{s.gitInit}</Checkbox>
          <Checkbox checked={github} onChange={setGithub}>
            {s.ghCreate}
            {login && <span className="text-fg-muted">{s.ghAs.replace('{login}', login)}</span>}
          </Checkbox>
          {github && login === null && <p className="pl-6 text-sm text-warning">{s.ghNoLogin}</p>}
          {github && (
            <div className="flex flex-col gap-3 pl-6">
              <div role="radiogroup" aria-label={s.ghVisibility} className="flex gap-2">
                {([true, false] as const).map(priv => (
                  <button key={String(priv)} type="button" role="radio" aria-checked={isPrivate === priv} onClick={() => setPrivate(priv)}
                    className={cn('h-8 rounded-lg border-2 bg-canvas px-3 text-sm transition-colors',
                      isPrivate === priv ? 'border-accent font-semibold text-fg' : 'border-line text-fg-secondary hover:border-fg-disabled')}>
                    {priv ? s.ghPrivate : s.ghPublic}
                  </button>
                ))}
              </div>
              <Field label={s.ghRepo} error={repoOk ? undefined : s.ghRepoError}>
                <Input value={repo} onChange={e => { repoTouched.current = true; setRepo(e.target.value.trim()) }} className="font-mono" spellCheck={false} invalid={!repoOk} />
              </Field>
            </div>
          )}
          {!options.template && WELCOME_FRAMEWORKS.includes(options.framework) && (
            <Checkbox checked={welcome} onChange={setWelcome} className="items-start">
              <span className="flex flex-col">
                <span>{s.welcome}</span>
                <span className="text-sm text-fg-muted">{s.welcomeHint}</span>
              </span>
            </Checkbox>
          )}
          {spa && (
            <Checkbox checked={spaAuth} onChange={setSpaAuth} className="items-start">
              <span className="flex flex-col">
                <span>{s.spaAuth}</span>
                <span className="text-sm text-fg-muted">{s.spaAuthHint}</span>
              </span>
            </Checkbox>
          )}
          {spa && spaAuth && (
            <div className="pl-6">
              <Field label={s.apiUrl} hint={s.apiUrlHint} error={apiOk ? undefined : s.apiUrlError}>
                <Input value={apiUrl} onChange={e => setApiUrl(e.target.value.trim())} className="font-mono" spellCheck={false} invalid={!apiOk} />
              </Field>
            </div>
          )}
          <Checkbox checked={openVSCode} onChange={setOpenVSCode}>{s.openVSCode}</Checkbox>
          <Checkbox checked={makeActive} onChange={setMakeActive}>{s.makeActive}</Checkbox>
        </Card>

        <Card className="flex flex-col gap-2.5 p-5">
          <CardTitle>{s.recapTitle}</CardTitle>
          <ol aria-label={s.recapTitle} tabIndex={0} className="flex max-h-[360px] flex-col gap-1.5 overflow-y-auto rounded-[10px] border border-line-subtle bg-console p-3 font-mono text-xs text-fg-secondary">
            <li className="text-fg-muted"># {baseLabel}{libraries > 0 ? ` · ${s.recapLibs.replace('{n}', String(libraries))}` : ''}</li>
            {steps.filter(step => step.kind !== 'connection').map((step, i) => step.kind === 'run'
              ? <li key={i} className="whitespace-pre-wrap break-all"><span className="text-accent">$ </span>{stepCommand(step)}</li>
              // Written by DevForge: what, then the files or lines
              : <li key={i} className="whitespace-pre-wrap break-all text-fg-muted"># {step.label}{'\n'}{stepCommand(step).split('\n').map(l => `  ${l}`).join('\n')}</li>)}
          </ol>
          <p className="text-sm text-fg-muted">{s.estimate.replace('{n}', String(minutes))}</p>
          {volumes.length > 0 && (
            <p role="status" className="rounded-xl bg-warning/10 p-3 text-sm text-fg">
              {s.oldVolumes.replace('{list}', volumes.join(', '))}
            </p>
          )}
        </Card>
      </div>

      {creating && <CreationProgress onBack={onBack} />}
    </WizardFrame>
  )
}
