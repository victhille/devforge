import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { SfEntityDraft, SfInspect, SfWriteResult } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useToast } from '@renderer/app/ToastContext'
import { cn } from '@renderer/lib/cn'
import IconButton from '@renderer/components/ui/IconButton'
import Spinner from '@renderer/components/ui/Spinner'
import EntitiesSection from './EntitiesSection'
import { symfonyKit } from './EntityForm'
import MigrationsSection from './MigrationsSection'
import ApiSection from './ApiSection'
import { DatabaseSection, FixturesSection, PagesSection, RoutesSection, ServerSection } from './ToolSections'
import { CommandButton, errorText, useSfTasks } from './parts'
import { SF_DRAFT_EVENT, takePendingDraft } from './draft'
import { sfCommandLine } from '@shared/lib/symfonyCommands'

type Part = 'database' | 'entities' | 'migrations' | 'api' | 'pages' | 'fixtures' | 'routes' | 'server'
const PARTS: Part[] = ['database', 'entities', 'migrations', 'api', 'pages', 'fixtures', 'routes', 'server']

/** The Symfony workshop of a project: buttons in place of bin/console */
export default function SymfonyPanel({ projectPath }: { projectPath: string }) {
  const { t } = useI18n()
  const s = t.symfony
  const toast = useToast()
  const [data, setData] = useState<SfInspect | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<SfEntityDraft | null>(() => takePendingDraft(projectPath))
  const [part, setPart] = useState<Part>('entities')
  const [serverUrl, setServerUrl] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    window.devforge.symfony.inspect(projectPath)
      .then(d => { setData(d); setLoadError('') })
      .catch(err => setLoadError(errorText(err)))
      .finally(() => setLoading(false))
    window.devforge.symfony.serverUrl(projectPath).then(setServerUrl).catch(() => setServerUrl(null))
  }, [projectPath])
  useEffect(load, [load])

  // An entity prepared by Forgy opens in the form
  useEffect(() => {
    const onDraft = () => {
      const d = takePendingDraft(projectPath)
      if (d) { setDraft(d); setPart('entities') }
    }
    window.addEventListener(SF_DRAFT_EVENT, onDraft)
    return () => window.removeEventListener(SF_DRAFT_EVENT, onDraft)
  }, [projectPath])

  const { exec, track } = useSfTasks(projectPath, useCallback((line: string) => line, []), useCallback(() => load(), [load]))

  function written(r: SfWriteResult) {
    const n = r.created.length + r.changed.length + r.removed.length
    toast.show({
      tone: 'success', title: s.written.replace('{n}', String(n)),
      description: [...r.created.map(f => `+ ${f}`), ...r.changed.map(f => `~ ${f}`), ...r.removed.map(f => `− ${f}`)].join('\n'),
      action: part === 'entities' ? { label: s.prepare, onClick: () => { setPart('migrations'); exec('migrations:diff') } } : undefined
    })
    load()
  }

  if (!data) {
    return loadError ? <p role="alert" className="text-sm text-danger">{loadError}</p> : <div className="flex justify-center p-10"><Spinner /></div>
  }
  const st = data.status
  const pending = data.migrations.filter(m => !m.executed).length
  const badge: Partial<Record<Part, string>> = {
    database: st.database?.reachable ? '●' : st.database ? '○' : undefined,
    entities: String(data.entities.length),
    migrations: pending ? s.pendingCount.replace('{n}', String(pending)) : undefined,
    server: serverUrl ? '●' : undefined
  }

  return (
    <div className="flex flex-col gap-4">
      {!st.booted && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle size={18} className="shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-fg">{st.error === 'NO_VENDOR' ? s.noVendor : s.notBooted}</p>
            {st.error && st.error !== 'NO_VENDOR' && <p className="mt-1 font-mono text-xs break-words text-fg-secondary">{st.error}</p>}
          </div>
          {st.error === 'NO_VENDOR' && <CommandButton command="composer:install" label={s.composerInstall} variant="primary" onRun={exec} />}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <nav aria-label={s.navLabel} className="flex w-[200px] shrink-0 flex-col gap-0.5">
          {PARTS.map(p => (
            <button key={p} onClick={() => setPart(p)} aria-current={part === p ? 'page' : undefined}
              className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                part === p ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
              <span className="flex-1">{s.parts[p]}</span>
              {badge[p] && <span className={cn('font-mono text-[11px]', p === 'migrations' ? 'text-warning' : badge[p] === '●' ? 'text-success' : 'text-fg-muted')}>{badge[p]}</span>}
            </button>
          ))}
          <div className="mt-3 flex items-center gap-2 px-3 text-xs text-fg-muted">
            <span className="flex-1 truncate">{st.version ? `Symfony ${st.version}` : 'Symfony'}</span>
            <IconButton size="sm" title={s.refresh} onClick={load} disabled={loading}><RefreshCw size={12} className={cn(loading && 'animate-spin')} /></IconButton>
          </div>
        </nav>

        <div className="min-w-0 flex-[1_1_640px]">
          {part === 'database' && <DatabaseSection projectPath={projectPath} status={st} exec={exec} onChanged={load} />}
          {part === 'entities' && (
            <EntitiesSection key={draft ? JSON.stringify(draft) : 'list'} kit={symfonyKit(projectPath, data.entities, s)} entities={data.entities}
              draft={draft} onDraftUsed={() => setDraft(null)} onWritten={written} />
          )}
          {part === 'migrations' && (
            <MigrationsSection migrations={data.migrations} databaseOk={!!st.database?.reachable}
              prepare={{ line: () => sfCommandLine('migrations:diff'), run: () => exec('migrations:diff') }}
              apply={{ line: () => sfCommandLine('migrations:migrate'), run: () => exec('migrations:migrate') }}
              rollback={{ line: () => sfCommandLine('migrations:prev'), run: () => exec('migrations:prev') }} />
          )}
          {part === 'api' && (
            <ApiSection entities={data.entities} onWritten={written} serverUrl={serverUrl} defaultUrl="http://127.0.0.1:8000"
              load={() => window.devforge.symfony.apiConfig(projectPath)} save={config => window.devforge.symfony.applyApi(projectPath, config)}
              platform={{ installed: st.packages.apiPlatform }} filesNote={s.jsonFiles}
              needs={mode => mode === 'platform'
                ? (st.packages.apiPlatform ? null : { text: s.needsPlatform, button: <CommandButton command="install:api-platform" label={s.install} variant="primary" onRun={exec} /> })
                : (st.packages.serializer && st.packages.validator ? null : { text: s.needsSerializer, button: <CommandButton command="install:serializer" label={s.install} variant="primary" onRun={exec} /> })} />
          )}
          {part === 'pages' && <PagesSection entities={data.entities} status={st} exec={exec} />}
          {part === 'fixtures' && (
            <FixturesSection entities={data.entities} ready={st.packages.fixtures && st.packages.foundry}
              install={<CommandButton command="install:fixtures" label={s.install} variant="primary" onRun={exec} />}
              line="php bin/console doctrine:fixtures:load --no-interaction" canRun={st.packages.maker && !!st.database?.reachable}
              onRun={counts => track(s.fixturesTask, () => window.devforge.symfony.writeFixtures(projectPath, counts))} />
          )}
          {part === 'routes' && <RoutesSection load={() => window.devforge.symfony.routes(projectPath)} serverUrl={serverUrl} defaultUrl="http://127.0.0.1:8000" help={s.routesHelp} />}
          {part === 'server' && <ServerSection status={st} serverUrl={serverUrl} exec={exec} />}
        </div>
      </div>
    </div>
  )
}
