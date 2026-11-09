import { useCallback, useEffect, useState } from 'react'
import { FileKey2 } from 'lucide-react'
import type { EnvProject } from '@shared/types'
import { NO_PROJECTS, useProjectList } from '@renderer/hooks/useLiveData'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import EmptyState from '@renderer/components/ui/EmptyState'
import { Skeleton } from '@renderer/components/ui/Skeleton'
import ProjectEnvEditor from './ProjectEnvEditor'
import { missingInEnv } from '@shared/lib/envKeys'
import SplitPane from '@renderer/components/ui/SplitPane'

/**
 * As in the mock-up: every project on the left, the keys its .env misses
 * (or how many files it has), a word on where the values stay; on the right
 * the chosen project's files.
 */
export default function EnvFilesPage() {
  const { t } = useI18n()
  const e = t.envFiles
  // v4.2: the shared project list, read again when a project is added or removed
  const projects = useProjectList().data ?? NO_PROJECTS
  const [envs, setEnvs] = useState<Record<string, EnvProject> | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Read every project's env files, to show warnings in the list (again when the list changes)
  useEffect(() => {
    let gone = false
    Promise.all(projects.map(p => window.devforge.env.read(p.path).then(env => [p.path, env] as const, () => [p.path, { projectPath: p.path, files: [] }] as const))).then(entries => {
      if (gone) return
      const map = Object.fromEntries(entries)
      setEnvs(map)
      // The chosen project stays, unless it was removed
      setSelected(prev => (prev && projects.some(p => p.path === prev) ? prev : projects.find(p => map[p.path]?.files.length)?.path ?? null))
    })
    return () => { gone = true }
  }, [projects])

  // The editor reports its changes: the list badges follow
  const onEnvChange = useCallback((env: EnvProject) => setEnvs(prev => ({ ...prev, [env.projectPath]: env })), [])
  // Projects with .env files first, then the others
  const sorted = [...projects].sort((a, b) => Number(!envs?.[a.path]?.files.length) - Number(!envs?.[b.path]?.files.length))

  return (
    <SplitPane width="md" label={e.projects} sideClassName="df-mockup" side={<>
      <div className="flex h-14 shrink-0 items-center px-4">
        <h2 className="font-display text-md font-bold tracking-[-.01em] text-fg">{e.projects}</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {!envs ? (
          <div role="status" aria-label={e.loading} className="flex flex-col gap-4 px-2.5 py-2.5">
            {[70, 52, 84].map(w => <Skeleton key={w} className="h-3.5" style={{ width: `${w}%` }} />)}
          </div>
        ) : projects.length === 0 ? (
          <p className="p-2.5 text-sm text-fg-muted">{e.noneFound}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {sorted.map(p => {
              const env = envs[p.path]
              const files = env?.files.length ?? 0
              const missing = env ? missingInEnv(env).length : 0
              const active = selected === p.path
              return (
                <li key={p.id}>
                  <button onClick={() => setSelected(p.path)} aria-current={active ? 'true' : undefined}
                    className={cn('flex h-10 w-full items-center gap-2.5 rounded-control px-2.5 text-left transition-colors',
                      active ? 'bg-accent-soft text-fg' : 'text-fg-secondary hover:bg-hover hover:text-fg')}>
                    <span className={cn('min-w-0 flex-1 truncate', active && 'font-semibold')}>{p.name}</span>
                    {missing > 0
                      ? <span title={e.missingCount.replace('{n}', String(missing))} className="flex h-5 min-w-5 items-center justify-center rounded-md bg-warning-soft px-1.5 text-xs font-semibold text-warning tabular-nums">
                          {missing}<span className="sr-only"> {e.missingCount.replace('{n}', String(missing))}</span>
                        </span>
                      : <span className="shrink-0 text-xs text-fg-muted">{files === 0 ? e.noFiles : (files > 1 ? e.filesMany : e.filesOne).replace('{n}', String(files))}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="shrink-0 px-5 pt-2 pb-5 text-xs text-fg-muted">{e.privacyNote}</p>
    </>}>
      <section className="df-mockup flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-8 pt-6.5 pb-8">
        {selected
          ? <ProjectEnvEditor key={selected} projectPath={selected} title={projects.find(p => p.path === selected)?.name} onEnvChange={onEnvChange} />
          : <EmptyState fill icon={<FileKey2 size={32} />} title={e.emptyTitle} description={e.emptyHint} />}
      </section>
    </SplitPane>
  )
}
