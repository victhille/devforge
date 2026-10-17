import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Framework, ProjectCreationOptions, AppSettings } from '@shared/types'
import { JS_FRAMEWORKS } from '@shared/data/projectLibraries'
import { useConsole } from '@renderer/app/ConsoleContext'
import TechSelector from './TechSelector'
import ConfigForm from './ConfigForm'
import LibrarySelector from './LibrarySelector'

type Step = 'select' | 'configure' | 'libraries'

/** Wizard: technology → configuration → libraries (JS only). */
export default function NewProjectPage() {
  const navigate = useNavigate()
  const { startCreation } = useConsole()
  const [step,      setStep]      = useState<Step>('select')
  const [framework, setFramework] = useState<Framework | null>(null)
  const [pending,   setPending]   = useState<ProjectCreationOptions | null>(null)
  const [settings,  setSettings]  = useState<AppSettings | null>(null)

  useEffect(() => {
    window.devforge.getSettings().then(setSettings)
  }, [])

  async function launch(options: ProjectCreationOptions, pkgs: string[], devPkgs: string[]) {
    await startCreation({ ...options, libraries: pkgs, devLibraries: devPkgs })
    navigate('/')
  }

  function handleConfig(options: ProjectCreationOptions) {
    setPending(options)
    if (JS_FRAMEWORKS.includes(options.framework)) setStep('libraries')
    else launch(options, [], [])
  }

  if (step === 'configure' && framework) {
    return <ConfigForm framework={framework} settings={settings} onBack={() => setStep('select')} onSubmit={handleConfig} />
  }

  if (step === 'libraries' && framework && pending) {
    return (
      <LibrarySelector
        framework={framework}
        onBack={() => setStep('configure')}
        onSubmit={(pkgs, devPkgs) => launch(pending, pkgs, devPkgs)}
      />
    )
  }

  return <TechSelector onSelect={fw => { setFramework(fw); setStep('configure') }} />
}
