import { useEffect, useState } from 'react'

/** Whether at least one server is set up; follows additions and removals */
export function useHasServer(): boolean {
  const [has, setHas] = useState(false)
  useEffect(() => {
    const load = () => { window.devforge.getSshConnections().then(c => setHas(c.length > 0)).catch(() => {}) }
    load()
    return window.devforge.onSshConnectionsChanged(load)
  }, [])
  return has
}

/** The name of the first server set up, null without one; follows additions, renames and removals */
export function useServerName(): string | null {
  const [name, setName] = useState<string | null>(null)
  useEffect(() => {
    const load = () => { window.devforge.getSshConnections().then(c => setName(c[0]?.name || null)).catch(() => {}) }
    load()
    return window.devforge.onSshConnectionsChanged(load)
  }, [])
  return name
}
