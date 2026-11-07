import { useState, useEffect } from 'react'
import type { Framework, ProjectCreationOptions, AppSettings, ProjectSetup, UserTemplate } from '@shared/types'
import { JS_FRAMEWORKS } from '@shared/data/projectLibraries'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { SETUP_FRAMEWORKS } from '@shared/lib/projectSetup'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import TechSelector from './TechSelector'
import ConfigForm from './ConfigForm'
import StackForm from './StackForm'
import LibrarySelector from './LibrarySelector'
import FinishForm from './FinishForm'
import WizardFrame, { type WizardStep } from './WizardFrame'
import CreationProgress, { useCreationProgress } from './CreationProgress'

type Step = 'select' | 'configure' | 'stack' | 'libraries' | 'finish'
type Stack = Pick<ProjectSetup, 'database' | 'dbName' | 'dbPort' | 'appPort' | 'features'>
const ORDER: Step[] = ['select', 'configure', 'stack', 'libraries', 'finish']

/** Wizard: technology → name → database and options → libraries (JS) → Git, GitHub and summary */
export default function NewProjectPage() {
  const { startCreation, hide } = useConsole()
  const { t, lang } = useI18n()
  const n = t.newProject
  const [step,      setStep]      = useState<Step>('select')
  const [framework, setFramework] = useState<Framework | null>(null)
  const [pending,   setPending]   = useState<ProjectCreationOptions | null>(null)
  const [stack,     setStack]     = useState<Stack | null>(null)
  const [settings,  setSettings]  = useState<AppSettings | null>(null)
  const [templates, setTemplates] = useState<UserTemplate[]>([])
  const [userTemplate, setUserTemplate] = useState<UserTemplate | null>(null)
  /** Once "Create" is clicked, the steps stay where they are */
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    window.devforge.getSettings().then(setSettings)
    window.devforge.templates.list().then(setTemplates).catch(() => {})
  }, [])

  const hasStack = (fw: Framework) => SETUP_FRAMEWORKS.includes(fw)
  const hasLibs  = (fw: Framework) => JS_FRAMEWORKS.includes(fw)

  async function launch(setup: ProjectSetup, makeActive: boolean, view: { planned: string[]; steps: string[] }) {
    if (!pending) return
    setCreating(true)
    // The page follows the creation (from any page, through the title bar); once saved, the project opens (and becomes the active one) if asked
    await startCreation({ ...pending, initGit: false, openAfter: false, setup, lang: lang === 'en' ? 'en' : 'fr' }, { openOnDone: makeActive, minimized: true, view })
  }

  // Back here while a creation runs (or just failed): its progress, not a new wizard
  const progress = useCreationProgress()
  if (step === 'select' && progress?.shown) {
    const last = progress.creation.steps.length - 1
    return (
      <WizardFrame steps={progress.creation.steps.map((label, i) => ({ label, state: i === last ? 'current' : 'done' }))} subtitle={n.setup.finishSubtitle} onBack={hide}>
        <CreationProgress onBack={hide} />
      </WizardFrame>
    )
  }

  function handleConfig(options: ProjectCreationOptions) {
    setPending({ ...options, libraries: [], devLibraries: [] })
    // A template of the user: copied as it is, straight to Git and GitHub
    if (options.template) { setStep('finish'); return }
    setStep(hasStack(options.framework) ? 'stack' : hasLibs(options.framework) ? 'libraries' : 'finish')
  }

  /** The steps bar of the page shown, from what was chosen so far */
  function stepsFor(current: Step): WizardStep[] {
    if (!framework) return []
    const fwName = userTemplate?.name ?? n.templateName[framework] ?? PROJECT_TEMPLATES.find(tpl => tpl.id === framework)?.name ?? framework
    const libCount = (pending?.libraries?.length ?? 0) + (pending?.devLibraries?.length ?? 0)
    const list: { at: Step; label: string; value?: string }[] = [
      { at: 'select', label: n.stepFramework, value: fwName },
      { at: 'configure', label: n.stepName, value: pending?.name }
    ]
    // One step per screen: the database goes with its options, Git with the summary
    if (!userTemplate && hasStack(framework)) {
      list.push({ at: 'stack', label: n.stepDb, value: stack ? n.stepDbValue.replace('{db}', n.setup.db[stack.database].name).replace('{n}', String(stack.features.length)) : undefined })
    }
    if (!userTemplate && hasLibs(framework)) list.push({ at: 'libraries', label: n.stepLibs, value: String(libCount) })
    list.push({ at: 'finish', label: n.stepGit })
    return list.map(s => {
      const state = ORDER.indexOf(s.at) < ORDER.indexOf(current) ? 'done' : s.at === current ? 'current' : 'todo'
      return {
        label: state === 'done' && s.value ? `${s.label} : ${s.value}` : s.label,
        state,
        onClick: state === 'done' && !creating ? () => setStep(s.at) : undefined
      }
    })
  }

  if (step === 'configure' && framework) {
    return <ConfigForm framework={framework} settings={settings} userTemplate={userTemplate} initial={pending} steps={stepsFor('configure')} onBack={() => setStep('select')} onSubmit={handleConfig} />
  }

  if (step === 'stack' && framework && pending) {
    return (
      <StackForm
        framework={framework}
        projectName={pending.name}
        initial={stack}
        steps={stepsFor('stack')}
        onBack={() => setStep('configure')}
        onSubmit={s => { setStack(s); setStep(hasLibs(framework) ? 'libraries' : 'finish') }}
      />
    )
  }

  if (step === 'libraries' && framework && pending) {
    return (
      <LibrarySelector
        framework={framework}
        steps={stepsFor('libraries')}
        onBack={() => setStep(hasStack(framework) ? 'stack' : 'configure')}
        onSubmit={(pkgs, devPkgs) => { setPending({ ...pending, libraries: pkgs, devLibraries: devPkgs }); setStep('finish') }}
      />
    )
  }

  if (step === 'finish' && framework && pending) {
    const back: Step = userTemplate ? 'configure' : hasLibs(framework) ? 'libraries' : hasStack(framework) ? 'stack' : 'configure'
    return (
      <FinishForm
        options={pending}
        stack={!userTemplate && hasStack(framework) ? stack : null}
        templateName={userTemplate?.name}
        libraries={(pending.libraries?.length ?? 0) + (pending.devLibraries?.length ?? 0)}
        steps={stepsFor('finish')}
        creating={creating}
        onBack={() => { setCreating(false); setStep(back) }}
        onSubmit={launch}
      />
    )
  }

  return (
    <TechSelector templates={templates} onSelect={fw => { setFramework(fw); setUserTemplate(null); setStack(null); setPending(null); setStep('configure') }}
      onTemplate={tpl => { setFramework(tpl.framework); setUserTemplate(tpl); setStack(null); setPending(null); setStep('configure') }} />
  )
}
