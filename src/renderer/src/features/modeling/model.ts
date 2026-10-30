import { useEffect, useState } from 'react'
import type { DbDiagram, ModelKind, ModelSummary } from '@shared/types'
import { errorText } from '@renderer/lib/errors'

/** v3.9: what the Modeling screens share (kept out of the components, for Fast Refresh) */

/** The colour of each kind's tag, the same everywhere */
export const KIND_TONE: Record<ModelKind, string> = {
  mcd: 'bg-[color-mix(in_srgb,var(--syntax-keyword)_16%,transparent)] text-[var(--syntax-keyword)]',
  mpd: 'bg-accent-soft text-accent',
  usecase: 'bg-success/15 text-success',
  class: 'bg-[color-mix(in_srgb,var(--syntax-number)_16%,transparent)] text-[var(--syntax-number)]',
  sequence: 'bg-[color-mix(in_srgb,var(--syntax-tag)_16%,transparent)] text-[var(--syntax-tag)]',
  flow: 'bg-[color-mix(in_srgb,var(--syntax-attr)_16%,transparent)] text-[var(--syntax-attr)]',
  architecture: 'bg-elevated text-fg-secondary'
}

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
