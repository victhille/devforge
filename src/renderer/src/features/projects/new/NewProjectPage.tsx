import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Framework, ProjectCreationOptions, AppSettings, ProjectSetup, UserTemplate } from '@shared/types'
import { JS_FRAMEWORKS } from '@shared/data/projectLibraries'
import { SETUP_FRAMEWORKS } from '@shared/lib/projectSetup'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import TechSelector from './TechSelector'
import ConfigForm from './ConfigForm'
import StackForm from './StackForm'
import LibrarySelector from './LibrarySelector'
import FinishForm from './FinishForm'

type Step = 'select' | 'configure' | 'stack' | 'libraries' | 'finish'
type Stack = Pick<ProjectSetup, 'database' | 'dbName' | 'dbPort' | 'appPort' | 'features'>

/** Wizard: technology → configuration → database and options → libraries (JS) → Git, GitHub and summary */
export default function NewProjectPage() {
  const navigate = useNavigate()
  const { startCreation } = useConsole()
  const { lang } = useI18n()
  const [step,      setStep]      = useState<Step>('select')
  const [framework, setFramework] = useState<Framework | null>(null)
  const [pending,   setPending]   = useState<ProjectCreationOptions | null>(null)
  const [stack,     setStack]     = useState<Stack | null>(null)
  const [settings,  setSettings]  = useState<AppSettings | null>(null)
  const [templates, setTemplates] = useState<UserTemplate[]>([])
  const [userTemplate, setUserTemplate] = useState<UserTemplate | null>(null)

  useEffect(() => {
    window.devforge.getSettings().then(setSettings)
    window.devforge.templates.list().then(setTemplates).catch(() => {})
  }, [])

  const hasStack = (fw: Framework) => SETUP_FRAMEWORKS.includes(fw)
  const hasLibs  = (fw: Framework) => JS_FRAMEWORKS.includes(fw)

  async function launch(setup: ProjectSetup) {
    if (!pending) return
    await startCreation({ ...pending, initGit: false, openAfter: false, setup, lang: lang === 'en' ? 'en' : 'fr' })
    navigate('/')
  }

  function handleConfig(options: ProjectCreationOptions) {
    setPending({ ...options, libraries: [], devLibraries: [] })
    // A template of the user: copied as it is, straight to Git and GitHub
    if (options.template) { setStep('finish'); return }
    setStep(hasStack(options.framework) ? 'stack' : hasLibs(options.framework) ? 'libraries' : 'finish')
  }

  if (step === 'configure' && framework) {
    return <ConfigForm framework={framework} settings={settings} userTemplate={userTemplate} onBack={() => setStep('select')} onSubmit={handleConfig} />
  }

  if (step === 'stack' && framework && pending) {
    return (
      <StackForm
        framework={framework}
        projectName={pending.name}
        initial={stack}
        onBack={() => setStep('configure')}
        onSubmit={s => { setStack(s); setStep(hasLibs(framework) ? 'libraries' : 'finish') }}
      />
    )
  }

  if (step === 'libraries' && framework && pending) {
    return (
      <LibrarySelector
        framework={framework}
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
        onBack={() => setStep(back)}
        onSubmit={launch}
      />
    )
  }

  return (
    <TechSelector templates={templates} onSelect={fw => { setFramework(fw); setUserTemplate(null); setStack(null); setStep('configure') }}
      onTemplate={tpl => { setFramework(tpl.framework); setUserTemplate(tpl); setStack(null); setStep('configure') }} />
  )
}
