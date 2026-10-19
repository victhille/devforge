import { useCallback, useEffect, useState } from 'react'
import type { Project } from '@shared/types'

/**
 * The project the app works on: chosen on the home page, or by opening a
 * project page (Ctrl K included). Kept by the main process, so the app and
 * the desktop widget follow the same one.
 */
export function useActiveProject(): { active: Project | null; setActive: (id: string | null) => Promise<void> } {
  const [active, setActiveState] = useState<Project | null>(null)

  useEffect(() => {
    let alive = true
    const show = async (id: string | null) => {
      const project = id ? (await window.devforge.getProjects()).find(p => p.id === id) ?? null : null
      if (alive) setActiveState(project)
    }
    window.devforge.hub.getActive().then(show).catch(() => {})
    const off = window.devforge.hub.onActive(id => { show(id) })
    return () => { alive = false; off() }
  }, [])

  const setActive = useCallback((id: string | null) => window.devforge.hub.setActive(id), [])
  return { active, setActive }
}
