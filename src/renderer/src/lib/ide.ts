import { useCallback, useEffect, useState } from 'react'
import type { DefaultIDE } from '@shared/types'

/** The name each IDE shows on a button */
export const IDE_LABEL: Record<DefaultIDE, string | null> = {
  vscode: 'VS Code', phpstorm: 'PhpStorm', webstorm: 'WebStorm', intellij: 'IntelliJ IDEA', none: null
}

/** The IDE chosen in Settings, read when the page shows (a change in Settings applies on the way back) */
export function usePreferredIde(): { ide: DefaultIDE; label: string | null; open: (path: string) => Promise<void> } {
  const [ide, setIde] = useState<DefaultIDE>('vscode')
  useEffect(() => {
    let alive = true
    window.devforge.getSettings().then(s => { if (alive) setIde(s.defaultIDE) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const open = useCallback((path: string) => window.devforge.openInIDE(path, ide), [ide])
  return { ide, label: IDE_LABEL[ide], open }
}

/** Opens a folder in the chosen IDE, outside React (console, one-off actions) */
export async function openInPreferredIde(path: string): Promise<void> {
  const { defaultIDE } = await window.devforge.getSettings()
  return window.devforge.openInIDE(path, defaultIDE)
}
