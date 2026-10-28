import { useCallback, useEffect, useState } from 'react'
import type { DefaultIDE } from '@shared/types'
import { IDE_CATALOG, type IdeInfo } from '@shared/data/ides'

/** The name of an IDE of the catalog (one added by hand: from the list) */
export const IDE_LABEL: Record<string, string | null> = {
  ...Object.fromEntries(IDE_CATALOG.map(i => [i.id, i.name])),
  none: null
}

export interface PreferredIde {
  /** The IDE chosen in Settings */
  ide: DefaultIDE
  /** Its name; null: no IDE, no button */
  label: string | null
  /** The catalog and the IDEs added by hand, with which are on this PC */
  list: IdeInfo[]
  /** The IDE a project opens in: its own, else the default (an own IDE removed since: the default) */
  pick: (own?: DefaultIDE) => DefaultIDE
  labelFor: (own?: DefaultIDE) => string | null
  open: (path: string, own?: DefaultIDE) => Promise<void>
  /** v3.5.3: a project's file, in the window of the project at `root` */
  openFile: (path: string, own?: DefaultIDE, root?: string, line?: number) => Promise<void>
}

/** The IDE chosen in Settings, read when the page shows (a change in Settings applies on the way back) */
export function usePreferredIde(): PreferredIde {
  const [ide, setIde] = useState<DefaultIDE>('vscode')
  const [list, setList] = useState<IdeInfo[]>([])
  useEffect(() => {
    let alive = true
    window.devforge.getSettings().then(s => { if (alive) setIde(s.defaultIDE) }).catch(() => {})
    window.devforge.listIdes().then(l => { if (alive) setList(l) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const nameOf = useCallback((id: DefaultIDE) => id === 'none' ? null : list.find(i => i.id === id)?.name ?? IDE_LABEL[id] ?? null, [list])
  const pick = useCallback((own?: DefaultIDE) => own && (own === 'none' || IDE_LABEL[own] || list.some(i => i.id === own)) ? own : ide, [ide, list])
  const labelFor = useCallback((own?: DefaultIDE) => nameOf(pick(own)), [nameOf, pick])
  const open = useCallback((path: string, own?: DefaultIDE) => window.devforge.openInIDE(path, pick(own)), [pick])
  const openFile = useCallback((path: string, own?: DefaultIDE, root?: string, line?: number) => window.devforge.openFileInIDE(path, pick(own), root, line), [pick])
  return { ide, label: nameOf(ide), list, pick, labelFor, open, openFile }
}

/** Opens a folder in the chosen IDE, outside React (console, one-off actions) */
export async function openInPreferredIde(path: string): Promise<void> {
  const { defaultIDE } = await window.devforge.getSettings()
  return window.devforge.openInIDE(path, defaultIDE)
}
