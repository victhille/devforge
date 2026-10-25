import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import type { NextCommand, NextInspect, SfWriteResult } from '@shared/types'
import { nextCommandLine } from '@shared/lib/nextCommands'
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
const DEV_URL = 'http://localhost:3000'

/** The Next.js workshop of a project: Prisma models, migrations, API routes, seed */
export default function NextPanel({ projectPath }: { projectPath: string }) {
  const { t } = useI18n()
  const s = t.symfony
  const n = t.nextjs
  const toast = useToast()
  const [data, setData] = useState<NextInspect | null>(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)
  const [part, setPart] = useState<Part>('entities')

  const load = useCallback(() => {
    setLoading(true)
    window.devforge.nextjs.inspect(projectPath)
      .then(d => { setData(d); setLoadError('') })
      .catch(err => setLoadError(errorText(err)))
      .finally(() => setLoading(false))
  }, [projectPath])
  useEffect(load, [load])

  const { track } = useSfTasks(projectPath, useCallback((line: string) => line, []), useCallback(() => load(), [load]))
  const pm = data?.status.packageManager ?? 'npm'
  const line = (command: NextCommand, arg?: string) => nextCommandLine(command, pm, arg)
  const exec = (command: NextCommand, arg?: string) => track(line(command, arg), () => window.devforge.nextjs.run(projectPath, command, arg))
  // install:client: the main process adds the driver adapter of the schema's provider
  const run = (command: NextCommand, label: string, variant?: 'primary' | 'secondary') =>
    <RunButton label={label} line={line(command, command === 'install:client' ? data?.status.provider ?? '' : undefined)} variant={variant} onRun={() => exec(command)} />

  function written(r: SfWriteResult) {
    const count = r.created.length + r.changed.length + r.removed.length
    toast.show({
      tone: 'success', title: s.written.replace('{n}', String(count)),
      description: [...r.created.map(f => `+ ${f}`), ...r.changed.map(f => `~ ${f}`), ...r.removed.map(f => `− ${f}`)].join('\n'),
      action: part === 'entities' ? { label: s.prepare, onClick: () => setPart('migrations') } : undefined
    })
    load()
  }
  async function write(start: () => Promise<SfWriteResult>) {
    try { written(await start()) } catch (err) { toast.show({ tone: 'error', title: errorText(err) }) }
  }

  if (!data) {
    return loadError ? <p role="alert" className="text-sm text-danger">{loadError}</p> : <div className="flex justify-center p-10"><Spinner /></div>
  }
  const st = data.status
  const dbOk = st.database.reachable
  const pending = data.migrations.filter(m => !m.executed).length
  const badge: Partial<Record<Part, string>> = {
    database: st.prisma ? (dbOk ? '●' : '○') : undefined,
    entities: String(data.entities.length),
    migrations: pending ? s.pendingCount.replace('{n}', String(pending)) : undefined
  }

  return (
    <div className="flex flex-wrap gap-4">
      <nav aria-label={n.navLabel} className="flex w-[200px] shrink-0 flex-col gap-0.5">
        {PARTS.map(p => (
          <button key={p} onClick={() => setPart(p)} aria-current={part === p ? 'page' : undefined}
            className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
              part === p ? 'bg-accent-soft font-semibold text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
            <span className="flex-1">{n.parts[p]}</span>
            {badge[p] && <span className={cn('font-mono text-[11px]', p === 'migrations' ? 'text-warning' : badge[p] === '●' ? 'text-success' : 'text-fg-muted')}>{badge[p]}</span>}
          </button>
        ))}
        <div className="mt-3 flex items-center gap-2 px-3 text-xs text-fg-muted">
          <span className="flex-1 truncate">{st.prismaVersion ? `Prisma ${st.prismaVersion}` : 'Next.js'}</span>
          <IconButton size="sm" title={s.refresh} onClick={load} disabled={loading}><RefreshCw size={12} className={cn(loading && 'animate-spin')} /></IconButton>
        </div>
      </nav>

      <div className="min-w-0 flex-[1_1_640px]">
        {part === 'database' && (
          <Section title={n.dbTitle} help={n.dbHelp}>
            {!st.prisma ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-warning/10 p-3">
                <span className="flex-1 text-sm text-fg">{n.noPrisma}</span>
                {run('install:prisma', n.installPrisma, 'primary')}
              </div>
            ) : (
              <dl className="grid grid-cols-[140px_1fr] items-start gap-x-4 gap-y-3 text-sm">
                <dt className="text-fg-muted">Prisma</dt>
                <dd className="text-fg">{n.prismaLine.replace('{version}', String(st.prismaVersion ?? '?')).replace('{provider}', st.provider ?? '?')}</dd>
                <dt className="text-fg-muted">{s.dbState}</dt>
                <dd className="flex flex-col items-start gap-2">
                  <span className={dbOk ? 'text-success' : 'text-warning'}>{dbOk ? s.dbReachable : s.dbUnreachable}</span>
                  {st.database.error && <code className="font-mono text-xs break-words text-fg-muted">{st.database.error}</code>}
                  <DbAuthHint error={st.database.error} envFile=".env" />
                  {!dbOk && st.composeDatabase && run('db:start', s.dbStart)}
                </dd>
                <dt className="text-fg-muted">{n.client}</dt>
                <dd className="flex flex-col items-start gap-2">
                  {st.client ? <span className="text-success">{n.ok}</span> : <><span className="text-warning">{n.noClient}</span>{run('install:client', n.installClient)}</>}
                </dd>
                <dt className="text-fg-muted">{n.lib}</dt>
                <dd className="flex flex-col items-start gap-2">
                  {st.libPrisma ? <span className="text-success">{n.libOk}</span> : <>
                    <span className="text-warning">{n.noLib}</span>
                    <Button size="sm" disabled={!st.client} onClick={() => write(() => window.devforge.nextjs.writePrismaClient(projectPath))}>{n.writeLib}</Button>
                  </>}
                </dd>
              </dl>
            )}
            {st.prisma && (
              <div className="flex flex-wrap items-center gap-3 border-t border-line-subtle pt-4">
                {run('prisma:studio', n.studio)}
                <span className="text-xs text-fg-muted">{n.studioHint}</span>
              </div>
            )}
          </Section>
        )}
        {part === 'entities' && (
          <EntitiesSection entities={data.entities} draft={null} onDraftUsed={() => {}} onWritten={written}
            kit={{
              write: draft => window.devforge.nextjs.writeModel(projectPath, draft),
              files: () => ['~ prisma/schema.prisma'],
              help: n.entityHelp, listHelp: n.entitiesHelp
            }} />
        )}
        {part === 'migrations' && (
          <MigrationsSection migrations={data.migrations} databaseOk={dbOk} note={n.migrationsNote}
            prepare={{ named: true, line: name => line('prisma:migrate', name), run: name => exec('prisma:migrate', name) }}
            apply={{ line: () => line('prisma:deploy'), run: () => exec('prisma:deploy') }}
            rollback={null} />
        )}
        {part === 'api' && (
          <ApiSection entities={data.entities} onWritten={written} serverUrl={null} defaultUrl={DEV_URL}
            load={() => window.devforge.nextjs.apiConfig(projectPath)} save={config => window.devforge.nextjs.applyApi(projectPath, config)}
            filesNote={n.jsonFiles}
            needs={() => st.libPrisma ? null : { text: n.needsLib, button: <Button size="sm" variant="primary" disabled={!st.client} onClick={() => write(() => window.devforge.nextjs.writePrismaClient(projectPath))}>{n.writeLib}</Button> }} />
        )}
        {part === 'fixtures' && (
          <FixturesSection entities={data.entities} ready={st.seedTools} install={run('install:seed', s.install, 'primary')}
            line={line('seed')} canRun={st.libPrisma && dbOk}
            onRun={counts => track(n.seedTask, () => window.devforge.nextjs.writeSeed(projectPath, counts))} />
        )}
        {part === 'routes' && (
          <RoutesSection serverUrl={null} defaultUrl={DEV_URL} help={n.routesHelp}
            load={() => window.devforge.nextjs.routes(projectPath).then(list => list.map(r => ({
              name: r.file, path: r.path, methods: r.kind === 'page' ? ['GET'] : r.methods, controller: r.file
            })))} />
        )}
        {part === 'server' && (
          <Section title={n.serverTitle} help={n.serverHelp}>
            <div className="flex flex-wrap items-start gap-4">
              {run('dev', n.devStart, 'primary')}
              <Button size="sm" variant="secondary" onClick={() => window.devforge.openExternal(DEV_URL)}><ExternalLink size={13} /> {n.openSite}</Button>
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
