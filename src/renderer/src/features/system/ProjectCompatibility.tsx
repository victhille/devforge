import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import type { EnvironmentTool, Project, ProjectRequirements, RuntimeTool } from '@shared/types'
import { satisfies } from '@shared/lib/semver'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import Card from '@renderer/components/ui/Card'
import { SectionTitle } from '@renderer/components/ui/Page'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'

const TOOL_LABEL: Record<RuntimeTool, string> = { node: 'Node.js', php: 'PHP', python: 'Python' }

type Status = 'ok' | 'mismatch' | 'missing' | 'unknown'

const STATUS_STYLE: Record<Status, { icon: typeof CheckCircle2; className: string }> = {
  ok:       { icon: CheckCircle2,  className: 'text-success' },
  mismatch: { icon: AlertTriangle, className: 'text-danger' },
  missing:  { icon: AlertTriangle, className: 'text-warning' },
  unknown:  { icon: HelpCircle,    className: 'text-fg-muted' }
}

/** Required runtime versions per project vs what is installed. */
export default function ProjectCompatibility({ tools }: { tools: EnvironmentTool[] }) {
  const { t } = useI18n()
  const c = t.environment
  const [projects, setProjects] = useState<Project[]>([])
  const [reqs, setReqs] = useState<ProjectRequirements[]>([])

  useEffect(() => {
    window.devforge.getProjects().then(async list => {
      setProjects(list)
      setReqs(await window.devforge.versions.requirements(list.map(p => p.path)))
    })
  }, [])

  const installed = (tool: RuntimeTool) => tools.find(x => x.id === tool && x.status === 'detected')?.version ?? null

  const rows = reqs.flatMap(r => {
    const project = projects.find(p => p.path === r.projectPath)
    if (!project) return []
    return r.requirements.map(req => {
      const version = installed(req.tool)
      const ok = version ? satisfies(version, req.range) : null
      const status: Status = !version ? 'missing' : ok === null ? 'unknown' : ok ? 'ok' : 'mismatch'
      return { project, req, version, status }
    })
  })

  if (tools.length === 0 || rows.length === 0) return null
  const problems = rows.filter(r => r.status === 'mismatch' || r.status === 'missing').length

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <SectionTitle>{c.compatTitle}</SectionTitle>
        <span className={cn('text-xs', problems ? 'text-danger' : 'text-success')}>
          {problems ? c.compatProblems.replace('{n}', String(problems)) : c.compatAllGood}
        </span>
      </div>
      <Card className="divide-y divide-line-subtle">
        {rows
          .sort((a, b) => Number(a.status === 'ok') - Number(b.status === 'ok'))
          .map(({ project, req, version, status }) => {
            const { icon: Icon, className } = STATUS_STYLE[status]
            return (
              <div key={`${project.id}-${req.tool}`} className="flex items-center gap-3 px-5 py-2.5">
                <ProjectIcon framework={project.framework} size="sm" />
                <span className="w-44 truncate font-medium text-fg">{project.name}</span>
                <span className="w-20 text-sm text-fg-secondary">{TOOL_LABEL[req.tool]}</span>
                <span className="flex-1 font-mono text-xs text-fg-secondary">
                  {req.range} <span className="text-fg-muted">· {req.source}</span>
                </span>
                <span className="w-24 text-right font-mono text-xs text-fg-secondary">{version ?? '—'}</span>
                <span className={cn('flex w-36 items-center justify-end gap-1.5 text-sm', className)}>
                  <Icon size={14} /> {c.compatStatus[status]}
                </span>
              </div>
            )
          })}
      </Card>
    </section>
  )
}
