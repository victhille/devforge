import { useNavigate } from 'react-router-dom'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'
import { modelUrl, siblings, type ModelTab } from './model'

/**
 * v3.9 lot 3: the steps of one model, MCD → MLD → MPD → SQL, in the editor's bar.
 * The MLD needs the MCD; the MPD and the SQL need the MPD.
 */
export default function ModelTabs({ projectPath, file, tab, hasMcd, hasMpd, before }: {
  projectPath: string
  file: string
  tab: ModelTab
  hasMcd: boolean
  hasMpd: boolean
  /** Run before leaving this tab (saving what is left) */
  before?: () => void
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const s = siblings(file)
  return (
    <nav aria-label={t.modeling.tabsLabel} className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-canvas p-0.5">
      {(['mcd', 'mld', 'mpd', 'sql'] as const).map(x => {
        const ok = x === 'mcd' || x === 'mld' ? hasMcd : hasMpd
        return (
          <button key={x} type="button" disabled={!ok} aria-current={tab === x ? 'page' : undefined}
            onClick={() => { if (x === tab) return; before?.(); navigate(modelUrl(projectPath, x === 'mcd' || x === 'mld' ? s.mcd : s.mpd, x), { replace: true }) }}
            className={cn('rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors',
              tab === x ? 'bg-active text-fg' : ok ? 'text-fg-secondary hover:bg-hover hover:text-fg' : 'cursor-not-allowed text-fg-disabled')}>
            {t.modeling.chainTag[x]}
          </button>
        )
      })}
    </nav>
  )
}
