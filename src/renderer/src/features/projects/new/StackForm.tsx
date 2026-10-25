import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check } from 'lucide-react'
import type { Framework, PhpStatus, ProjectSetup, SetupDatabase, SetupFeature } from '@shared/types'
import { DB_NAME_RE, DEFAULT_DB_PORT, SETUP_FEATURES } from '@shared/lib/projectSetup'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import Card, { CardTitle } from '@renderer/components/ui/Card'
import Checkbox from '@renderer/components/ui/Checkbox'
import { Field, Input } from '@renderer/components/ui/Input'
import { Page, PageHeader } from '@renderer/components/ui/Page'

type Stack = Pick<ProjectSetup, 'database' | 'dbName' | 'dbPort' | 'features'>

interface Props {
  framework: Framework
  projectName: string
  /** Choices made before going back */
  initial: Stack | null
  onBack: () => void
  onSubmit: (stack: Stack) => void
}

const DATABASES: SetupDatabase[] = ['postgres', 'mysql', 'sqlite', 'none']

/** Step 3 (Symfony, Next.js): database and options */
export default function StackForm({ framework, projectName, initial, onBack, onSubmit }: Props) {
  const { t } = useI18n()
  const s = t.newProject.setup
  const [database, setDatabase] = useState<SetupDatabase>(initial?.database ?? 'postgres')
  const [dbName, setDbName] = useState(initial?.dbName || projectName.replace(/-/g, '_').replace(/^[^a-zA-Z_]/, '_$&').slice(0, 63))
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

  // Symfony: Composer and the database driver need PHP extensions that a fresh Windows PHP keeps off
  const [php, setPhp] = useState<PhpStatus | null>(null)
  const [phpBusy, setPhpBusy] = useState(false)
  const [phpNote, setPhpNote] = useState('')
  useEffect(() => {
    if (framework !== 'symfony') return
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
  const phpProblem = framework === 'symfony' && php !== null && (!php.found || php.missing.length > 0)

  const server = database === 'postgres' || database === 'mysql'
  const toggle = (f: SetupFeature, on: boolean) => setFeatures(list => on ? [...list, f] : list.filter(x => x !== f))
  const desc = (f: SetupFeature) => framework === 'symfony' ? s.featSymfony[f] : s.featNext[f]

  function submit() {
    if (server && !DB_NAME_RE.test(dbName)) { setError(s.dbNameError); return }
    const port = server ? ports[database as 'postgres' | 'mysql'] : 0
    onSubmit({ database, dbName, dbPort: port, features: SETUP_FEATURES.filter(f => features.includes(f)) })
  }

  const willDo = [
    ...(server ? [s.doCompose.replace('{engine}', s.db[database].name)] : []),
    ...(database !== 'none' ? [s.doEnv.replace('{file}', framework === 'symfony' ? '.env.local' : '.env')] : []),
    ...(framework === 'nextjs' && database !== 'none' ? [s.doPrisma] : []),
    ...(server ? [s.doStart] : []),
    ...(database !== 'none' ? [s.doConnection] : [])
  ]

  return (
    <Page className="max-w-5xl">
      <div><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft size={14} /> {t.newProject.back}</Button></div>
      <PageHeader title={s.title} subtitle={s.subtitle} />

      {phpProblem && php && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle size={18} className="shrink-0 text-warning" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold text-fg">{s.phpTitle}</span>
            <span className="text-sm text-fg-secondary">
              {!php.found ? s.phpNotFound : !php.ini ? s.phpNoIni : s.phpMissing.replace('{list}', php.missing.join(', '))}
            </span>
            {php.found && php.ini && <span className="text-sm text-fg-muted">{s.phpBackup}</span>}
          </div>
          {php.found && php.ini && <Button variant="secondary" disabled={phpBusy} onClick={enablePhp}>{s.phpEnable}</Button>}
        </div>
      )}
      {phpNote && !phpProblem && <p role="status" className="text-sm text-success">{phpNote}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-5">
          <CardTitle>{s.dbTitle}</CardTitle>
          <div role="radiogroup" aria-label={s.dbTitle} className="grid grid-cols-2 gap-2">
            {DATABASES.map(db => (
              <button
                key={db}
                type="button"
                role="radio"
                aria-checked={database === db}
                onClick={() => { setDatabase(db); setError('') }}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-xl border-2 p-3 text-left transition-colors',
                  database === db ? 'border-accent bg-accent-soft' : 'border-line-subtle bg-surface hover:border-line'
                )}
              >
                <span className="font-semibold text-fg">{s.db[db].name}</span>
                <span className="text-sm text-fg-secondary">{s.db[db].desc}</span>
              </button>
            ))}
          </div>
          {server && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={s.dbName} error={error}>
                <Input value={dbName} onChange={e => { setDbName(e.target.value); setError('') }} spellCheck={false} invalid={!!error} />
              </Field>
              <Field label={s.dbPort} hint={s.dbPortHint}>
                <Input
                  type="number" min={1} max={65535}
                  value={ports[database as 'postgres' | 'mysql']}
                  onChange={e => setPorts(p => ({ ...p, [database]: Number(e.target.value) }))}
                />
              </Field>
            </div>
          )}
          {willDo.length > 0 && (
            <div className="flex flex-col gap-1 rounded-xl bg-canvas p-3 text-sm">
              <span className="text-fg-muted">{s.willDo}</span>
              {willDo.map(line => <span key={line} className="flex items-center gap-2 text-fg-secondary"><Check size={12} className="text-success" />{line}</span>)}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3 p-5">
          <CardTitle>{s.featTitle}</CardTitle>
          {SETUP_FEATURES.map(f => (
            <Checkbox key={f} checked={features.includes(f)} onChange={on => toggle(f, on)} className="items-start rounded-lg p-1.5">
              <span className="flex flex-col">
                <span className="font-medium text-fg">{s.feat[f]}</span>
                <span className="text-sm text-fg-secondary">{desc(f)}</span>
              </span>
            </Checkbox>
          ))}
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto text-sm text-fg-muted">{s.cmdHint}</span>
        <Button variant="ghost" onClick={onBack}>{t.newProject.cancel}</Button>
        <Button size="lg" onClick={submit}>{t.newProject.next}</Button>
      </div>
    </Page>
  )
}
