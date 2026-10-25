import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import type { LaravelCommand, LaravelInspect, SfWriteResult } from '@shared/types'
import { laravelCommandLine } from '@shared/lib/laravelCommands'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import Button from '@renderer/components/ui/Button'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import EntitiesSection from '../symfony/EntitiesSection'
import MigrationsSection from '../symfony/MigrationsSection'
import ApiSection from '../symfony/ApiSection'
import { FixturesSection, RoutesSection } from '../symfony/ToolSections'
import { DbAuthHint, RunButton, Section, errorText, useSfTasks } from '../symfony/parts'

type Part = 'database' | 'entities' | 'migrations' | 'api' | 'fixtures' | 'routes' | 'server'
const PARTS: Part[] = ['database', 'entities', 'migrations', 'api', 'fixtures', 'routes', 'server']

/** The Laravel workshop of a project: Eloquent models, migrations, API controllers, seeder */
export default function LaravelPanel({ projectPath }: { projectPath: string }) {
  const { t } = useI18n()
  const s = t.symfony
  const l = t.laravel
  const toast = useToast()
  const [data, setData] = useState<LaravelInspect | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [part, setPart] = useState<Part>('entities')

  const load = useCallback(() => {
    setLoading(true)
    window.devforge.laravel.inspect(projectPath)
      .then(d => { setData(d); setLoadError('') })
      .catch(err => setLoadError(errorText(err)))
      .finally(() => setLoading(false))
  }, [projectPath])
  useEffect(load, [load])

  const { track } = useSfTasks(projectPath, useCallback((line: string) => line, []), useCallback(() => load(), [load]))
  // With Sail, PHP runs in the app's container: the lines say so
  const cl = (command: LaravelCommand, arg?: string) => laravelCommandLine(command, arg, !!data?.status.sail)
  const exec = (command: LaravelCommand, arg?: string) => track(cl(command, arg), () => window.devforge.laravel.run(projectPath, command, arg))
  const run = (command: LaravelCommand, label: string, variant?: 'primary' | 'secondary') =>
    <RunButton label={label} line={cl(command)} variant={variant} onRun={() => exec(command)} />

  function written(r: SfWriteResult) {
    const count = r.created.length + r.changed.length + r.removed.length
    toast.show({
      tone: 'success', title: s.written.replace('{n}', String(count)),
      description: [...r.created.map(f => `+ ${f}`), ...r.changed.map(f => `~ ${f}`), ...r.removed.map(f => `− ${f}`)].join('\n'),
      action: part === 'entities' ? { label: s.parts.migrations, onClick: () => setPart('migrations') } : undefined
    })
    load()
  }

  if (!data) {
    return loadError ? <p role="alert" className="text-sm text-danger">{loadError}</p> : <div className="flex justify-center p-10"><Spinner /></div>
  }
  const st = data.status
  const dbOk = st.database.reachable
  const pending = data.migrations.filter(m => !m.executed).length
  const badge: Partial<Record<Part, string>> = {
    database: st.booted ? (dbOk ? '●' : '○') : undefined,
    entities: String(data.entities.length),
    migrations: pending && dbOk ? s.pendingCount.replace('{n}', String(pending)) : undefined
  }
  const modelFile = (name: string) => `app/Models/${name}.php`

  return (
    <div className="flex flex-col gap-4">
      {!st.booted && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle size={18} className="shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fg">{st.error === 'NO_VENDOR' ? s.noVendor : st.error === 'SAIL_DOWN' ? l.sailDown : l.notBooted}</p>
            {st.error && st.error !== 'NO_VENDOR' && st.error !== 'SAIL_DOWN' && <p className="mt-1 font-mono text-xs break-words text-fg-secondary">{st.error}</p>}
          </div>
          {st.error === 'NO_VENDOR' && run('composer:install', s.composerInstall, 'primary')}
          {st.error === 'SAIL_DOWN' && run('db:start', l.sailStart, 'primary')}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <nav aria-label={l.navLabel} className="flex w-[200px] shrink-0 flex-col gap-0.5">
          {PARTS.map(p => (
            <button key={p} onClick={() => setPart(p)} aria-current={part === p ? 'page' : undefined}
              className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                part === p ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
              <span className="flex-1">{l.parts[p]}</span>
              {badge[p] && <span className={cn('font-mono text-[11px]', p === 'migrations' ? 'text-warning' : badge[p] === '●' ? 'text-success' : 'text-fg-muted')}>{badge[p]}</span>}
            </button>
          ))}
          <div className="mt-3 flex items-center gap-2 px-3 text-xs text-fg-muted">
            <span className="flex-1 truncate">{st.version ? `Laravel ${st.version}` : 'Laravel'}</span>
            <IconButton size="sm" title={s.refresh} onClick={load} disabled={loading}><RefreshCw size={12} className={cn(loading && 'animate-spin')} /></IconButton>
          </div>
        </nav>

        <div className="min-w-0 flex-[1_1_640px]">
          {part === 'database' && (
            <Section title={s.dbTitle} help={l.dbHelp}>
              <dl className="grid grid-cols-[140px_1fr] items-start gap-x-4 gap-y-3 text-sm">
                <dt className="text-fg-muted">{l.connection}</dt>
                <dd className="font-mono text-fg">{st.connection ?? '—'}</dd>
                <dt className="text-fg-muted">{s.dbState}</dt>
                <dd className="flex flex-col items-start gap-2">
                  <span className={dbOk ? 'text-success' : 'text-warning'}>{dbOk ? s.dbReachable : s.dbUnreachable}</span>
                  {st.database.error && <code className="font-mono text-xs break-words text-fg-muted">{st.database.error}</code>}
                  <DbAuthHint error={st.database.error} envFile=".env" />
                  {!dbOk && st.composeDatabase && run('db:start', st.sail ? l.sailStart : s.dbStart)}
                  {st.sail && <span className="text-xs text-fg-muted">{l.sailDb}</span>}
                </dd>
              </dl>
            </Section>
          )}
          {part === 'entities' && (
            <EntitiesSection entities={data.entities} draft={null} onDraftUsed={() => {}} onWritten={written}
              kit={{
                write: draft => window.devforge.laravel.writeModel(projectPath, draft),
                files: (owner, existing, linked) => [
                  ...(existing ? [`~ ${existing.file}`] : owner ? [`+ ${modelFile(owner)}`] : []),
                  ...(owner ? ['+ database/migrations/…'] : []),
                  ...linked.map(tg => `~ ${modelFile(tg)}`)
                ],
                help: l.entityHelp, listHelp: l.entitiesHelp
              }} />
          )}
          {part === 'migrations' && (
            <MigrationsSection migrations={data.migrations} databaseOk={dbOk && st.booted} note={l.migrationsNote} help={l.migrationsHelp}
              prepare={{ named: true, label: l.prepare, line: name => cl('make:migration', name), run: name => exec('make:migration', name) }}
              apply={{ line: () => cl('migrate'), run: () => exec('migrate') }}
              rollback={{ line: () => cl('migrate:rollback'), run: () => exec('migrate:rollback') }} />
          )}
          {part === 'api' && (
            <ApiSection entities={data.entities} onWritten={written} serverUrl={null} defaultUrl={st.appUrl}
              load={() => window.devforge.laravel.apiConfig(projectPath)} save={config => window.devforge.laravel.applyApi(projectPath, config)}
              filesNote={l.jsonFiles}
              needs={() => st.api ? null : { text: l.needsApi, button: run('install:api', l.installApi, 'primary') }} />
          )}
          {part === 'fixtures' && (
            <FixturesSection entities={data.entities} ready={st.faker} install={<p className="text-sm text-fg-muted">{l.needsFaker}</p>}
              line={cl('seed')} canRun={st.booted && dbOk}
              onRun={counts => track(l.seedTask, () => window.devforge.laravel.writeSeed(projectPath, counts))} />
          )}
          {part === 'routes' && (
            <RoutesSection serverUrl={null} defaultUrl={st.appUrl} help={l.routesHelp} load={() => window.devforge.laravel.routes(projectPath)} />
          )}
          {part === 'server' && (
            <Section title={l.serverTitle} help={st.sail ? l.sailHelp : l.serverHelp}>
              <div className="flex flex-wrap items-start gap-4">
                {run('serve', st.sail ? l.sailStart : l.serve, 'primary')}
                {st.sail && run('sail:stop', l.sailStop)}
                <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(st.appUrl)}><ExternalLink size={13} /> {l.openSite.replace('{url}', st.appUrl)}</Button>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-line-subtle pt-4">
                {run('optimize:clear', l.clear)}
                {run('composer:install', s.composerInstall)}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}
