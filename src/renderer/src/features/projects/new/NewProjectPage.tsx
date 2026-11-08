import { useState, useEffect, useRef } from 'react'
import type { Framework, ProjectCreationOptions, AppSettings, ProjectSetup, UserTemplate } from '@shared/types'
import { JS_FRAMEWORKS } from '@shared/data/projectLibraries'
import { PROJECT_TEMPLATES } from '@shared/data/projectTemplates'
import { SETUP_FRAMEWORKS } from '@shared/lib/projectSetup'
import { useConsole } from '@renderer/app/ConsoleContext'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import TechSelector from './TechSelector'
import ConfigForm, { type ConfigHandle } from './ConfigForm'
import StackForm, { type Stack, type StackHandle } from './StackForm'
import LibrarySelector from './LibrarySelector'
import FinishForm from './FinishForm'
import WizardFrame, { RecapList, type WizardStep } from './WizardFrame'
import CreationProgress, { useCreationProgress } from './CreationProgress'

type Step = 'select' | 'options' | 'libraries' | 'finish'
const ORDER: Step[] = ['select', 'options', 'libraries', 'finish']

/**
 * The new project wizard, as in the mock-up: technology → options and database
 * (one screen) → libraries (JavaScript, optional) → Git, GitHub and the creation.
 * The steps stand on the left, what will be made on the right.
 */
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
  // The options screen: its two sections, and what they hold so far (for the summary)
  const config = useRef<ConfigHandle>(null)
  const stackForm = useRef<StackHandle>(null)
  const [draftName, setDraftName] = useState('')
  const [draftStack, setDraftStack] = useState<Stack | null>(null)

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

  /** The steps on the left, from what was chosen so far */
  function stepsFor(current: Step): WizardStep[] {
    const own = !userTemplate && !!framework
    const list: { at: Step | 'create'; label: string; hint?: string }[] = [
      { at: 'select', label: n.stepTech },
      { at: 'options', label: n.stepOptions },
      ...(own && hasStack(framework!) ? [{ at: 'options' as const, label: n.stepDatabase }] : []),
      ...(own && hasLibs(framework!) ? [{ at: 'libraries' as const, label: n.stepLibs, hint: n.stepOptional }] : []),
      { at: 'finish', label: n.stepGit },
      { at: 'create', label: n.stepCreate }
    ]
    return list.map(s => {
      if (s.at === 'create') return { label: s.label, state: creating ? 'current' : 'todo' }
      const hint = s.hint
      const before = ORDER.indexOf(s.at) < ORDER.indexOf(current) || (creating && s.at === 'finish')
      const state = before ? 'done' : s.at === current ? 'current' : 'todo'
      return { label: s.label, hint, state, onClick: state === 'done' && !creating ? () => setStep(s.at as Step) : undefined }
    })
  }

  // Back here while a creation runs (or just failed): its progress, not a new wizard
  const progress = useCreationProgress()
  if (step === 'select' && progress?.shown) {
    const last = progress.creation.steps.length - 1
    return (
      <WizardFrame steps={progress.creation.steps.map((label, i) => ({ label, state: i === last ? 'current' : 'done' }))}
        title={n.setup.finishTitle} subtitle={n.setup.finishSubtitle} onBack={hide}
        asideTitle={n.setup.nextTitle} aside={<p className="text-sm text-fg-secondary">{n.setup.nextText}</p>}>
        <CreationProgress onBack={hide} />
      </WizardFrame>
    )
  }

  if (step === 'options' && framework) {
    const withStack = !userTemplate && hasStack(framework)
    const server = draftStack?.database === 'postgres' || draftStack?.database === 'mysql'
    function next() {
      const options = config.current?.submit()
      if (!options) return
      const chosen = withStack ? stackForm.current?.submit() ?? null : null
      if (withStack && !chosen) return
      setPending({ ...options, libraries: [], devLibraries: [] })
      setStack(chosen)
      // A template of the user: copied as it is, straight to Git and GitHub
      setStep(options.template ? 'finish' : hasLibs(framework!) ? 'libraries' : 'finish')
    }
    return (
      <WizardFrame steps={stepsFor('options')} title={n.optionsTitle}
        subtitle={userTemplate ? t.templates.fromTemplate.replace('{name}', userTemplate.name) : n.wizardSubtitle.replace('{name}', n.templateName[framework] ?? PROJECT_TEMPLATES.find(x => x.id === framework)?.name ?? framework)}
        onBack={() => setStep('select')}
        asideTitle={n.setup.recapShort}
        aside={
          <RecapList rows={[
            { label: n.setup.recapProject, value: draftName || '—', mono: true },
            ...(withStack && draftStack ? [{ label: n.setup.recapDb, value: n.setup.db[draftStack.database].name }] : []),
            ...(withStack && server ? [
              { label: n.setup.dbPort, value: String(draftStack!.dbPort), mono: true },
              { label: n.setup.recapFiles, value: `compose.yaml${framework === 'nextjs' ? ', prisma/' : ''}`, mono: true }
            ] : [])
          ]} />
        }
        footer={<Button onClick={next}>{n.continue}</Button>}>
        <ConfigForm ref={config} framework={framework} settings={settings} userTemplate={userTemplate} initial={pending} onName={setDraftName} />
        {withStack && <StackForm ref={stackForm} framework={framework} projectName={draftName} initial={stack} onDraft={setDraftStack} />}
      </WizardFrame>
    )
  }

  if (step === 'libraries' && framework && pending) {
    return (
      <LibrarySelector
        framework={framework}
        steps={stepsFor('libraries')}
        onBack={() => setStep('options')}
        onSubmit={(pkgs, devPkgs) => { setPending({ ...pending, libraries: pkgs, devLibraries: devPkgs }); setStep('finish') }}
      />
    )
  }

  if (step === 'finish' && framework && pending) {
    const back: Step = !userTemplate && hasLibs(framework) ? 'libraries' : 'options'
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

  // A new choice starts the next screens afresh
  const pick = (fw: Framework, tpl: UserTemplate | null) => {
    if (fw !== framework || tpl?.id !== userTemplate?.id) { setStack(null); setPending(null); setDraftStack(null) }
    setFramework(fw)
    setUserTemplate(tpl)
  }
  return (
    <TechSelector steps={stepsFor('select')} templates={templates} framework={framework} template={userTemplate}
      onPick={fw => pick(fw, null)} onTemplate={tpl => pick(tpl.framework, tpl)} onContinue={() => { if (framework) setStep('options') }} />
  )
}
