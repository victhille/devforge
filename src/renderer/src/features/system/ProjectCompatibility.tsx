import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'
import type { EnvironmentTool, Project, ProjectRequirements, RuntimeTool, VersionRequirement } from '@shared/types'
import { NO_PROJECTS, useProjectList } from '@renderer/hooks/useLiveData'
import { satisfies } from '@shared/lib/semver'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import ProjectIcon from '@renderer/features/projects/components/ProjectIcon'

const TOOL_LABEL: Record<RuntimeTool, string> = { node: 'Node.js', php: 'PHP', python: 'Python' }

export type CompatStatus = 'ok' | 'mismatch' | 'missing' | 'unknown'

export interface CompatRow { project: Project; req: VersionRequirement; version: string | null; status: CompatStatus }

const STATUS_STYLE: Record<CompatStatus, { icon: typeof CheckCircle2; className: string }> = {
  ok:       { icon: CheckCircle2,  className: 'text-success' },
  mismatch: { icon: AlertTriangle, className: 'text-danger' },
  missing:  { icon: AlertTriangle, className: 'text-warning' },
  unknown:  { icon: HelpCircle,    className: 'text-fg-muted' }
}

/** Each project's required runtime versions against what is installed (the shared project list; read again when it changes) */
export function useCompatibility(tools: EnvironmentTool[]): CompatRow[] {
  const projects = useProjectList().data ?? NO_PROJECTS
  const [reqs, setReqs] = useState<ProjectRequirements[]>([])

  useEffect(() => {
    let gone = false
    window.devforge.versions.requirements(projects.map(p => p.path)).then(r => { if (!gone) setReqs(r) })
    return () => { gone = true }
  }, [projects])

  const installed = (tool: RuntimeTool) => tools.find(x => x.id === tool && x.status === 'detected')?.version ?? null
  return reqs.flatMap(r => {
    const project = projects.find(p => p.path === r.projectPath)
    if (!project) return []
    return r.requirements.map(req => {
      const version = installed(req.tool)
      const ok = version ? satisfies(version, req.range) : null
      const status: CompatStatus = !version ? 'missing' : ok === null ? 'unknown' : ok ? 'ok' : 'mismatch'
      return { project, req, version, status }
    })
  })
}

/** Required runtime versions per project vs what is installed: a card like the tools' ones, problems first */
export default function ProjectCompatibility({ rows }: { rows: CompatRow[] }) {
  const { t } = useI18n()
  const c = t.environment
  if (rows.length === 0) return null
  const problems = rows.filter(r => r.status === 'mismatch' || r.status === 'missing').length

  return (
    <section aria-labelledby="env-compat" className="df-rise overflow-hidden rounded-card border border-line-subtle bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3.5">
        <h2 id="env-compat" className="font-display text-md font-bold text-fg">{c.compatTitle}</h2>
        <span className={cn('text-sm', problems ? 'text-danger' : 'text-success')}>
          {problems ? c.compatProblems.replace('{n}', String(problems)) : c.compatAllGood}
        </span>
      </div>
      <ul className="divide-y divide-line-subtle">
        {[...rows]
          .sort((a, b) => Number(a.status === 'ok') - Number(b.status === 'ok'))
          .map(({ project, req, version, status }) => {
            const { icon: Icon, className } = STATUS_STYLE[status]
            return (
              <li key={`${project.id}-${req.tool}`} className="flex items-center gap-3 px-4 py-2.5">
                <ProjectIcon framework={project.framework} size="sm" />
                <span className="w-44 truncate font-semibold text-fg">{project.name}</span>
                <span className="w-20 text-sm text-fg-secondary">{TOOL_LABEL[req.tool]}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-fg-secondary">
                  {req.range} <span className="text-fg-muted">· {req.source}</span>
                </span>
                <span className="w-24 text-right font-mono text-sm text-fg">{version ?? '—'}</span>
                <span className={cn('flex w-40 items-center justify-end gap-1.5 text-sm', className)}>
                  <Icon size={14} aria-hidden /> {c.compatStatus[status]}
                </span>
              </li>
            )
          })}
      </ul>
    </section>
  )
}
