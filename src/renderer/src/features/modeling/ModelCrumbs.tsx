import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import { useProjectList } from '@renderer/hooks/useLiveData'
import IconButton from '@renderer/components/ui/IconButton'

/**
 * v4.1: where a model is, and the way back. Opened from a project's Modeling
 * tab (`from` = its id): Project › Modélisation › the model, the arrow back to
 * the project; else Modélisation › the model.
 */
export default function ModelCrumbs({ name, before }: { name: string; before?: () => void }) {
  const { t } = useI18n()
  const m = t.modeling
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const from = params.get('from')
  // v4.2: the kept list of projects, so the crumb shows at once
  const projects = useProjectList().data
  const project = from ? projects?.find(p => p.id === from)?.name ?? null : null

  const go = (to: string) => { before?.(); navigate(to) }
  const projectPage = from && project ? `/project/${encodeURIComponent(from)}?tab=modeling` : null
  const crumb = 'max-w-[160px] truncate rounded px-1 text-fg-secondary transition-colors hover:bg-hover hover:text-fg'
  return (
    <nav aria-label={m.crumbs.label} className="flex shrink-0 items-center gap-1">
      <IconButton size="sm" title={m.crumbs.back} onClick={() => go(projectPage ?? '/modeling')}><ArrowLeft size={14} /></IconButton>
      <ol className="flex items-center gap-0.5 text-sm">
        {projectPage && (
          <li className="flex items-center gap-0.5">
            <button type="button" className={crumb} onClick={() => go(projectPage)}>{project}</button>
            <ChevronRight size={13} className="shrink-0 text-fg-disabled" aria-hidden />
          </li>
        )}
        <li className="flex items-center gap-0.5">
          <button type="button" className={crumb} onClick={() => go('/modeling')}>{m.title}</button>
          <ChevronRight size={13} className="shrink-0 text-fg-disabled" aria-hidden />
        </li>
        <li aria-current="page"><h1 className="max-w-[220px] truncate px-1 text-md font-semibold text-fg">{name}</h1></li>
      </ol>
    </nav>
  )
}
