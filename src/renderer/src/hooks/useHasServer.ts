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
