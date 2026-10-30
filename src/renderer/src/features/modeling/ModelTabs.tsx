import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ModelSummary } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { cn } from '@renderer/lib/cn'

export type ModelTab = 'mcd' | 'mld' | 'mpd' | 'sql'

export const modelUrl = (projectPath: string, file: string, tab?: ModelTab) =>
  `/model?project=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(file)}${tab ? `&tab=${tab}` : ''}`

/** An MCD, its MPD and its SQL share a base name: boutique.mcd.json, boutique.mpd.json, boutique.sql */
export function siblings(file: string) {
  const base = file.replace(/\.[a-z]+\.json$/, '')
  return { base, mcd: `${base}.mcd.json`, mpd: `${base}.mpd.json`, sql: `${base}.sql` }
}

/** The model's MCD and MPD as the project lists them (either may be missing) */
export function useSiblings(projectPath: string, file: string, tick = 0) {
  const [found, setFound] = useState<{ mcd?: ModelSummary; mpd?: ModelSummary } | null>(null)
  useEffect(() => {
    const s = siblings(file)
    window.devforge.modeling.list(projectPath)
      .then(list => setFound({ mcd: list.find(x => x.file === s.mcd), mpd: list.find(x => x.file === s.mpd) }))
      .catch(() => setFound({}))
  }, [projectPath, file, tick])
  return found
}

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
