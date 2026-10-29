import { useCallback, useEffect, useState } from 'react'
import type { EnvProject, Project } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Badge from '@renderer/components/ui/Badge'
import EmptyState from '@renderer/components/ui/EmptyState'
import { SectionTitle } from '@renderer/components/ui/Page'
import { FileKey2 } from 'lucide-react'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'
import ProjectEnvEditor, { missingInEnv } from './ProjectEnvEditor'

export default function EnvFilesPage() {
  const { t } = useI18n()
  const e = t.envFiles
  const [projects, setProjects] = useState<Project[]>([])
  const [envs, setEnvs] = useState<Record<string, EnvProject>>({})
  const [selected, setSelected] = useState<string | null>(null)

  // Read every project's env files once, to show warnings in the list
  useEffect(() => {
    window.devforge.getProjects().then(async list => {
      setProjects(list)
      const entries = await Promise.all(list.map(p => window.devforge.env.read(p.path).then(env => [p.path, env] as const, () => [p.path, { projectPath: p.path, files: [] }] as const)))
      const map = Object.fromEntries(entries)
      setEnvs(map)
      setSelected(prev => prev ?? list.find(p => map[p.path]?.files.length)?.path ?? null)
    })
  }, [])

  // The editor reports its changes: the list badges follow
  const onEnvChange = useCallback((env: EnvProject) => setEnvs(prev => ({ ...prev, [env.projectPath]: env })), [])
  const withEnv = projects.filter(p => envs[p.path]?.files.length)

  return (
    <div className="flex h-full">
      {/* Projects */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-line-subtle bg-sidebar">
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
      </aside>

      {/* Detail */}
      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
        {selected
          ? <ProjectEnvEditor key={selected} projectPath={selected} title={projects.find(p => p.path === selected)?.name} onEnvChange={onEnvChange} />
          : <EmptyState icon={<FileKey2 size={32} />} title={e.emptyTitle} description={e.emptyHint} />}
      </section>
    </div>
  )
}
