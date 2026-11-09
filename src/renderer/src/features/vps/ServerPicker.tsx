import { useEffect, useState } from 'react'
import type { SSHConnection } from '@shared/types'
import { NO_SERVERS, useSshConnections } from '@renderer/hooks/useLiveData'
import { useI18n } from '@renderer/i18n/I18nContext'
import { Select } from '@renderer/components/ui/Input'

const KEY = 'devforge:vps-server'

/** Saved servers and the one picked (remembered across the VPS pages; a page may keep its own choice) */
export function useServerPicker(key = KEY) {
  const { data, error } = useSshConnections()
  const connections: SSHConnection[] | null = data ?? (error ? NO_SERVERS : null)
  const [serverId, setServerId] = useState(() => { try { return localStorage.getItem(key) ?? '' } catch { return '' } })

  // The one remembered while it exists, else the first (a server removed elsewhere is let go)
  useEffect(() => {
    if (connections) setServerId(prev => (connections.some(x => x.id === prev) ? prev : connections[0]?.id ?? ''))
  }, [connections])
  useEffect(() => { try { if (serverId) localStorage.setItem(key, serverId) } catch { /* not kept */ } }, [serverId, key])

  return { connections, conn: connections?.find(c => c.id === serverId), serverId, setServerId }
}

/** The picker of the header, only when there is a choice to make (as in the mock-up, one server needs none) */
export function ServerSelect({ connections, value, onChange }: { connections: SSHConnection[] | null; value: string; onChange: (id: string) => void }) {
  const { t } = useI18n()
  if (!connections || connections.length < 2) return null
  return (
    <label className="flex items-center gap-2 text-sm text-fg-secondary">
      {t.vpsOps.server}
      <Select value={value} onChange={e => onChange(e.target.value)} className="w-64">
        {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.host}</option>)}
      </Select>
    </label>
  )
}
