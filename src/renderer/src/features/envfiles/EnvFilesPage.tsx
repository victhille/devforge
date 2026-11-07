import { useCallback, useEffect, useState } from 'react'
import type { EnvProject } from '@shared/types'
import { NO_PROJECTS, useProjectList } from '@renderer/hooks/useLiveData'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import EmptyState from '@renderer/components/ui/EmptyState'
import { SectionTitle } from '@renderer/components/ui/Page'
import { FileKey2 } from 'lucide-react'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import ProjectEnvEditor, { missingInEnv } from './ProjectEnvEditor'
import SplitPane from '@renderer/components/ui/SplitPane'

export default function EnvFilesPage() {
  const { t } = useI18n()
  const e = t.envFiles
  // v4.2: the shared project list, read again when a project is added or removed
  const projects = useProjectList().data ?? NO_PROJECTS
  const [envs, setEnvs] = useState<Record<string, EnvProject>>({})
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
  const withEnv = projects.filter(p => envs[p.path]?.files.length)

  return (
    <SplitPane width="md" label={e.projects} side={<>
      {/* Projects */}
        <div className="flex h-11 shrink-0 items-center border-b border-line-subtle px-4">
          <SectionTitle>{e.projects}</SectionTitle>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {withEnv.length === 0 && <p className="p-4 text-sm text-fg-muted">{e.noneFound}</p>}
          {withEnv.map(p => {
            const m = missingInEnv(envs[p.path]).length
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.path)}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', selected === p.path ? 'bg-active' : 'hover:bg-hover')}
              >
                <ProjectIcon framework={p.framework} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-fg">{p.name}</span>
                  <span className="text-2xs text-fg-muted">{(envs[p.path].files.length > 1 ? e.filesMany : e.filesOne).replace('{n}', String(envs[p.path].files.length))}</span>
                </span>
                {m > 0 && <Badge color="danger">{m}</Badge>}
              </button>
            )
          })}
        </div>
      </>}>
      {/* Detail */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-8">
        {selected
          ? <ProjectEnvEditor key={selected} projectPath={selected} title={projects.find(p => p.path === selected)?.name} onEnvChange={onEnvChange} />
          : <EmptyState icon={<FileKey2 size={32} />} title={e.emptyTitle} description={e.emptyHint} />}
      </section>
    </SplitPane>
  )
}
