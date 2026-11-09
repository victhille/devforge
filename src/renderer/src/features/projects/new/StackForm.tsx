import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import type { Framework, PhpStatus, ProjectSetup, SetupDatabase, SetupFeature } from '@shared/types'
import { DB_NAME_RE, DEFAULT_DB_PORT, SETUP_FEATURES } from '@shared/lib/projectSetup'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Switch from '@renderer/components/ui/Switch'
import { Field, Input } from '@renderer/components/ui/Input'
import { FamilyLabel, OptionRow } from './WizardFrame'
import Notice from '@renderer/components/ui/Notice'

export type Stack = Pick<ProjectSetup, 'database' | 'dbName' | 'dbPort' | 'appPort' | 'features'>

interface Props {
  framework: Framework
  projectName: string
  /** Choices made before going back */
  initial: Stack | null
  /** The choices as they are made, for the summary on the right */
  onDraft?: (stack: Stack) => void
}

/** The screen validates the section: the stack, or null (and the error shown) */
export interface StackHandle { submit: () => Stack | null }

/** In the mock-up's order: none, a file, then the servers in Docker */
const DATABASES: SetupDatabase[] = ['none', 'sqlite', 'postgres', 'mysql']

/** Step 2, second part (Symfony, Next.js, Laravel): the database and the options */
const StackForm = forwardRef<StackHandle, Props>(function StackForm({ framework, projectName, initial, onDraft }, ref) {
  const { t } = useI18n()
  const s = t.newProject.setup
  const [database, setDatabase] = useState<SetupDatabase>(initial?.database ?? 'postgres')
  const nameFor = (project: string) => project.replace(/-/g, '_').replace(/^[^a-zA-Z_]/, '_$&').slice(0, 63)
  const [dbName, setDbName] = useState(initial?.dbName || nameFor(projectName))
  const dbTouched = useRef(!!initial?.dbName)
  useEffect(() => { if (!dbTouched.current) setDbName(nameFor(projectName)) }, [projectName])
  const [ports, setPorts] = useState<Record<'postgres' | 'mysql', number>>(() => initial && (initial.database === 'postgres' || initial.database === 'mysql') ? { ...DEFAULT_DB_PORT, [initial.database]: initial.dbPort } : { ...DEFAULT_DB_PORT })
  const [features, setFeatures] = useState<SetupFeature[]>(initial?.features ?? ['api', 'tests', 'ci'])
  const [error, setError] = useState('')
  const keepPorts = useRef(initial !== null)

  // A free port on this PC, so a second project does not fight the first one
  useEffect(() => {
    if (keepPorts.current) return
    let alive = true
    Promise.all([window.devforge.setup.freePort(DEFAULT_DB_PORT.postgres), window.devforge.setup.freePort(DEFAULT_DB_PORT.mysql)])
      .then(([postgres, mysql]) => { if (alive) setPorts({ postgres, mysql }) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  // Laravel Sail serves the app on this PC: a free port from 8000
  const [appPort, setAppPort] = useState(8000)
  useEffect(() => {
    if (framework !== 'laravel') return
    let alive = true
    window.devforge.setup.freePort(8000).then(p => { if (alive) setAppPort(p) }).catch(() => {})
    return () => { alive = false }
  }, [framework])

  // Symfony: Composer and the database driver need PHP extensions that a fresh Windows PHP keeps off
  const [php, setPhp] = useState<PhpStatus | null>(null)
  const [phpBusy, setPhpBusy] = useState(false)
  const [phpNote, setPhpNote] = useState('')
  useEffect(() => {
    if (framework !== 'symfony' && framework !== 'laravel') return
    let alive = true
    window.devforge.setup.phpStatus(database).then(p => { if (alive) setPhp(p) }).catch(() => {})
    return () => { alive = false }
  }, [framework, database])

  async function enablePhp() {
    setPhpBusy(true)
    try {
      const p = await window.devforge.setup.phpEnable(database)
      setPhp(p)
      setPhpNote(p.missing.length ? s.phpMissing.replace('{list}', p.missing.join(', ')) : s.phpDone)
    } catch (err) {
      setPhpNote(s.phpError.replace('{error}', err instanceof Error ? err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(err)))
    } finally { setPhpBusy(false) }
  }
  const phpProblem = (framework === 'symfony' || framework === 'laravel') && php !== null && (!php.found || php.missing.length > 0)

  const server = database === 'postgres' || database === 'mysql'
  const toggle = (f: SetupFeature, on: boolean) => setFeatures(list => on ? [...list, f] : list.filter(x => x !== f))
  const desc = (f: SetupFeature) => framework === 'symfony' ? s.featSymfony[f] : framework === 'laravel' ? s.featLaravel[f] : s.featNext[f]

  const authSqlite = database === 'none' && features.includes('auth')

  // Accounts need a database: none chosen with authentication means SQLite
  const stackOf = (): Stack => ({ database: authSqlite ? 'sqlite' : database, dbName, dbPort: server ? ports[database as 'postgres' | 'mysql'] : 0, ...(framework === 'laravel' ? { appPort } : {}), features: SETUP_FEATURES.filter(f => features.includes(f)) })
  useImperativeHandle(ref, () => ({
    submit: () => {
      if (server && !DB_NAME_RE.test(dbName)) { setError(s.dbNameError); return null }
      return stackOf()
    }
  }))
  const draft = JSON.stringify(stackOf())
  useEffect(() => { onDraft?.(JSON.parse(draft)) }, [draft, onDraft])

  const willDo = [
    ...(server ? [s.doCompose.replace('{engine}', s.db[database].name)] : []),
    ...(database !== 'none' ? [s.doEnv.replace('{file}', framework === 'symfony' ? '.env.local' : '.env')] : []),
    ...(framework === 'nextjs' && database !== 'none' ? [s.doPrisma] : []),
    ...(server ? [s.doStart] : []),
    ...(database !== 'none' ? [s.doConnection] : [])
  ]

  return (
    <>
      {phpProblem && php && (
        <Notice tone="warning" live title={s.phpTitle}
          action={php.found && php.ini ? <Button variant="secondary" disabled={phpBusy} onClick={enablePhp}>{s.phpEnable}</Button> : undefined}>
          {!php.found ? s.phpNotFound : !php.ini ? s.phpNoIni : s.phpMissing.replace('{list}', php.missing.join(', '))}
          {php.found && php.ini && <span className="mt-0.5 block text-fg-muted">{s.phpBackup}</span>}
        </Notice>
      )}
      {phpNote && !phpProblem && <p role="status" className="text-sm text-success">{phpNote}</p>}

      <FamilyLabel>{s.dbTitle}</FamilyLabel>
      <div role="radiogroup" aria-label={s.dbTitle} className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3">
        {DATABASES.map(db => (
          <button key={db} type="button" role="radio" aria-checked={database === db} onClick={() => { setDatabase(db); setError('') }}
            className={cn('flex min-w-0 flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors',
              database === db ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-surface hover:border-fg-muted')}>
            <span className="truncate font-semibold text-fg">{s.db[db].name}</span>
            <span className="text-xs text-fg-muted">{s.db[db].desc}</span>
          </button>
        ))}
      </div>
      {server && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={s.dbName} error={error}>
            <Input value={dbName} onChange={e => { dbTouched.current = true; setDbName(e.target.value); setError('') }} className="font-mono" spellCheck={false} invalid={!!error} />
          </Field>
          <Field label={s.dbPort} hint={s.dbPortHint}>
            <Input type="number" min={1} max={65535} className="font-mono" value={ports[database as 'postgres' | 'mysql']}
              onChange={e => setPorts(p => ({ ...p, [database]: Number(e.target.value) }))} />
          </Field>
        </div>
      )}
      {willDo.length > 0 && (
        <ul aria-label={s.willDo} className="flex flex-col gap-1 text-sm">
          {willDo.map(line => <li key={line} className="flex items-center gap-2 text-fg-secondary"><Check size={12} aria-hidden className="shrink-0 text-success" />{line}</li>)}
        </ul>
      )}

      <FamilyLabel>{s.featTitle}</FamilyLabel>
      <div className="rounded-card border border-line-subtle bg-surface px-3.5">
        {SETUP_FEATURES.map(f => (
          <OptionRow key={f} label={s.feat[f]} hint={desc(f)}>
            <Switch checked={features.includes(f)} onChange={on => toggle(f, on)} label={s.feat[f]} />
          </OptionRow>
        ))}
      </div>
      {authSqlite && <p role="status" className="rounded-xl bg-accent-soft p-3 text-sm text-fg">{s.authSqlite}</p>}
    </>
  )
})

export default StackForm
