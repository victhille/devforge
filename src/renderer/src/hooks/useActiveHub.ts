import { useEffect, useState } from 'react'
import type { ProjectHub } from '@shared/types'
import { useActiveProject } from './useActiveProject'

/** The active project's hub (its compose project, databases…), null when none */
export function useActiveHub(): ProjectHub | null {
  const { active } = useActiveProject()
  const [hub, setHub] = useState<ProjectHub | null>(null)
  useEffect(() => {
    let alive = true
    if (!active) { setHub(null); return }
    window.devforge.hub.get(active.id).then(h => { if (alive) setHub(h) }).catch(() => { if (alive) setHub(null) })
    return () => { alive = false }
  }, [active])
  return hub
}
