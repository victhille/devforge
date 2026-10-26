import { useNavigate } from 'react-router-dom'
import { Plug } from 'lucide-react'
import { useI18n } from '@renderer/i18n/I18nContext'
import Button from '@renderer/components/ui/Button'
import EmptyState from '@renderer/components/ui/EmptyState'

export type SetupService = 'server' | 'github' | 'vercel' | 'forgy'

/**
 * A page that needs a service nobody has set up yet (v3.0 lot 2): what it
 * needs, and the way to Settings › Connections. No error, nothing missing.
 */
export default function NeedsSetup({ service, why, compact }: { service: SetupService; why?: string; compact?: boolean }) {
  const { t } = useI18n()
  const n = t.needsSetup
  const navigate = useNavigate()
  const go = () => navigate('/settings?section=connections')
  if (compact) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-fg-muted">{why ?? n.why[service]}</p>
        <Button size="sm" variant="secondary" className="self-start" onClick={go}><Plug size={13} /> {n.button[service]}</Button>
      </div>
    )
  }
  return (
    <EmptyState icon={<Plug size={28} />} title={n.title[service]} description={why ?? n.why[service]}
      action={<Button onClick={go}><Plug size={14} /> {n.button[service]}</Button>} />
  )
}
