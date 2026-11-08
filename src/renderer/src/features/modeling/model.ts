import { useEffect, useMemo, useState } from 'react'
import type { DbDiagram, ModelKind, ModelSummary } from '@shared/types'
import { errorText } from '@renderer/lib/errors'
import { useLive } from '@renderer/lib/live'

/** v3.9: what the Modeling screens share (kept out of the components, for Fast Refresh) */

/** The colour of each kind's tag, the same everywhere */
export const KIND_TONE: Record<ModelKind, string> = {
  mcd: 'bg-[color-mix(in_srgb,var(--diagram-violet)_16%,transparent)] text-[var(--diagram-violet)]',
  mpd: 'bg-accent-soft text-accent',
  usecase: 'bg-success/15 text-success',
  class: 'bg-[color-mix(in_srgb,var(--diagram-orange)_16%,transparent)] text-[var(--diagram-orange)]',
  sequence: 'bg-[color-mix(in_srgb,var(--diagram-red)_16%,transparent)] text-[var(--diagram-red)]',
  flow: 'bg-[color-mix(in_srgb,var(--diagram-yellow)_16%,transparent)] text-[var(--diagram-yellow)]',
  architecture: 'bg-elevated text-fg-secondary'
}

export type ModelTab = 'mcd' | 'mld' | 'mpd' | 'sql'

/** `from`: the id of the project whose page opened it (v4.1: the crumbs lead back there) */
export const modelUrl = (projectPath: string, file: string, tab?: ModelTab, from?: string | null) =>
  `/model?project=${encodeURIComponent(projectPath)}&file=${encodeURIComponent(file)}${tab ? `&tab=${tab}` : ''}${from ? `&from=${encodeURIComponent(from)}` : ''}`

/** An MCD, its MPD and its SQL share a base name: boutique.mcd.json, boutique.mpd.json, boutique.sql */
export function siblings(file: string) {
  const base = file.replace(/\.[a-z]+\.json$/, '')
  return { base, mcd: `${base}.mcd.json`, mpd: `${base}.mpd.json`, sql: `${base}.sql` }
}

/**
 * v4.2: a project's models, kept between pages (shown at once when coming
 * back) and read again as soon as one is written or removed: by Forgy, an
 * import, an editor.
 */
export function useModels(projectPath: string | undefined) {
  return useLive<ModelSummary[]>(projectPath ? `models:${projectPath.toLowerCase()}` : null, () => window.devforge.modeling.list(projectPath!),
    projectPath ? { topic: 'models', scope: projectPath } : undefined)
}

/** The model's MCD and MPD as the project lists them (either may be missing); `tick`: read again now */
export function useSiblings(projectPath: string, file: string, tick = 0) {
  const { data: list, loaded, reload } = useModels(projectPath)
  useEffect(() => { if (tick) void reload() }, [tick, reload])
  return useMemo(() => {
    if (!list) return loaded ? {} : null
    const s = siblings(file)
    return { mcd: list.find(x => x.file === s.mcd), mpd: list.find(x => x.file === s.mpd) } as { mcd?: ModelSummary; mpd?: ModelSummary }
  }, [list, loaded, file])
}

/** "{a} and {b}" filled in */
export const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all))

/** v3.9 lot 4: the linked database as its schema reads, read again on demand */
export function useLinkedDb(connection?: string) {
  const [state, setState] = useState<{ diagram?: DbDiagram; error?: string; loading: boolean }>({ loading: false })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!connection) { setState({ loading: false }); return }
    let live = true
    setState(s => ({ ...s, loading: true, error: undefined }))
    window.devforge.db.diagram(connection)
      .then(diagram => { if (live) setState({ diagram, loading: false }) })
      .catch(err => { if (live) setState({ loading: false, error: errorText(err) }) })
    return () => { live = false }
  }, [connection, tick])
  return { ...state, refresh: () => setTick(x => x + 1) }
}
