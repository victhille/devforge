import { useEffect, useState } from 'react'
import type { SSHConnection } from '@shared/types'
import { useI18n } from '@renderer/i18n/I18nContext'
import { Select } from '@renderer/components/ui/Input'

const KEY = 'devforge:vps-server'

/** Saved servers and the one picked (remembered across the VPS pages) */
export function useServerPicker() {
  const [connections, setConnections] = useState<SSHConnection[] | null>(null)
  const [serverId, setServerId] = useState(() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })

  useEffect(() => {
    window.devforge.getSshConnections().then(c => {
      setConnections(c)
      setServerId(prev => (c.some(x => x.id === prev) ? prev : c[0]?.id ?? ''))
    }).catch(() => setConnections([]))
  }, [])
  useEffect(() => { try { if (serverId) localStorage.setItem(KEY, serverId) } catch { /* not kept */ } }, [serverId])

  return { connections, conn: connections?.find(c => c.id === serverId), serverId, setServerId }
}

export function ServerSelect({ connections, value, onChange }: { connections: SSHConnection[] | null; value: string; onChange: (id: string) => void }) {
  const { t } = useI18n()
  if (!connections?.length) return null
  return (
    <label className="flex items-center gap-2 text-sm text-fg-secondary">
      {t.vpsOps.server}
      <Select value={value} onChange={e => onChange(e.target.value)} className="w-64">
        {connections.map(c => <option key={c.id} value={c.id}>{c.name} · {c.host}</option>)}
      </Select>
    </label>
  )
}
